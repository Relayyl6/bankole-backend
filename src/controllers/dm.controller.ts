import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.config';
import { AuthRequest } from '../middlewares/auth.middleware';
import { buildError, notFound, forbidden, parsePagination, paginatedResponse } from '../utils/response';

// ─── Schema ───────────────────────────────────────────────────────────────────

export const createThreadSchema = z.object({
  agentId: z.string().uuid('agentId must be a valid UUID'),
});

export const sendDmSchema = z.object({
  body: z.string().min(1, 'Message cannot be empty').max(4000),
});

// ─── Controllers ─────────────────────────────────────────────────────────────

export const getOrCreateThread = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { agentId } = req.body;

    // Validate agentId exists
    const { data: agent, error: agentError } = await supabase
      .from('users')
      .select('id, full_name, avatar_url')
      .eq('id', agentId)
      .maybeSingle();

    if (agentError) throw agentError;
    if (!agent) return notFound(res, 'Agent');

    // Check existing thread
    const { data: existingThread, error: threadError } = await supabase
      .from('message_threads')
      .select('*, sender:users!message_threads_sender_id_fkey(id, full_name, avatar_url), agent:users!message_threads_agent_id_fkey(id, full_name, avatar_url)')
      .or(`and(sender_id.eq.${user.id},agent_id.eq.${agentId}),and(sender_id.eq.${agentId},agent_id.eq.${user.id})`)
      .limit(1)
      .maybeSingle();

    if (threadError) throw threadError;

    if (existingThread) {
      const isSender = existingThread.sender_id === user.id;
      const participant = isSender ? existingThread.agent : existingThread.sender;
      
      return res.status(200).json({
        threadId: existingThread.id,
        participant: {
          id: participant.id,
          name: participant.full_name,
          avatarUrl: participant.avatar_url ?? null,
        },
        lastMessage: existingThread.last_message,
        unreadCount: existingThread.unread_count,
        updatedAt: existingThread.updated_at,
      });
    }

    // Create new thread
    const { data: newThread, error: insertError } = await supabase
      .from('message_threads')
      .insert({
        sender_id: user.id,
        agent_id: agentId,
        last_message: null,
        unread_count: 0,
      })
      .select('*, sender:users!message_threads_sender_id_fkey(id, full_name, avatar_url), agent:users!message_threads_agent_id_fkey(id, full_name, avatar_url)')
      .single();

    if (insertError) throw insertError;

    const participant = newThread.agent;

    return res.status(201).json({
      threadId: newThread.id,
      participant: {
        id: participant.id,
        name: participant.full_name,
        avatarUrl: participant.avatar_url ?? null,
      },
      lastMessage: newThread.last_message,
      unreadCount: newThread.unread_count,
      updatedAt: newThread.updated_at,
    });

  } catch (err) {
    next(err);
  }
};

export const listThreads = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    const { data: threads, error } = await supabase
      .from('message_threads')
      .select('*, sender:users!message_threads_sender_id_fkey(id, full_name, avatar_url), agent:users!message_threads_agent_id_fkey(id, full_name, avatar_url)')
      .or(`sender_id.eq.${user.id},agent_id.eq.${user.id}`)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const formattedThreads = (threads || []).map((thread: any) => {
      const isSender = thread.sender_id === user.id;
      const participant = isSender ? thread.agent : thread.sender;

      return {
        threadId: thread.id,
        participant: {
          id: participant.id,
          name: participant.full_name,
          avatarUrl: participant.avatar_url ?? null,
        },
        lastMessage: thread.last_message,
        unreadCount: thread.unread_count,
        updatedAt: thread.updated_at,
      };
    });

    return res.status(200).json({ data: formattedThreads });
  } catch (err) {
    next(err);
  }
};

export const getThreadMessages = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { threadId } = req.params;
    const pagination = parsePagination(req.query);

    const { data: thread, error: threadError } = await supabase
      .from('message_threads')
      .select('*')
      .eq('id', threadId)
      .maybeSingle();

    if (threadError) throw threadError;
    if (!thread) return notFound(res, 'Thread');

    if (thread.sender_id !== user.id && thread.agent_id !== user.id) {
      return forbidden(res);
    }

    // Mark thread as read: reset unread_count on the thread for this user.
    // Note: Supabase JS client doesn't support array_append natively; the full
    // per-message read_by tracking can be added via a Postgres function if needed.
    await supabase
      .from('message_threads')
      .update({ unread_count: 0 })
      .eq('id', threadId);

    const { data, count, error } = await supabase
      .from('direct_messages')
      .select('*', { count: 'exact' })
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .range(pagination.offset, pagination.offset + pagination.perPage - 1);

    if (error) throw error;

    const formattedMessages = (data || []).map((m: any) => ({
      id: m.id,
      authorId: m.author_id,
      body: m.body,
      createdAt: m.created_at,
    }));

    return res.status(200).json(paginatedResponse(formattedMessages, count ?? 0, pagination));
  } catch (err) {
    next(err);
  }
};

export const sendThreadMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { threadId } = req.params;
    const { body } = req.body;

    const { data: thread, error: threadError } = await supabase
      .from('message_threads')
      .select('*')
      .eq('id', threadId)
      .maybeSingle();

    if (threadError) throw threadError;
    if (!thread) return notFound(res, 'Thread');

    if (thread.sender_id !== user.id && thread.agent_id !== user.id) {
      return forbidden(res);
    }

    const { data: message, error: messageError } = await supabase
      .from('direct_messages')
      .insert({
        thread_id: threadId,
        author_id: user.id,
        body,
        read_by: [],
      })
      .select('*')
      .single();

    if (messageError) throw messageError;

    // Update message_threads
    const unreadCount = thread.unread_count + 1;
    await supabase
      .from('message_threads')
      .update({
        last_message: body,
        updated_at: new Date().toISOString(),
        unread_count: unreadCount,
      })
      .eq('id', threadId);

    return res.status(201).json({
      id: message.id,
      authorId: message.author_id,
      body: message.body,
      createdAt: message.created_at,
    });
  } catch (err) {
    next(err);
  }
};

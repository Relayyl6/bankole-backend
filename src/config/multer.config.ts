import multer from 'multer';

// Store uploads in memory so we can pass the buffer to EXIF extraction and Supabase Storage
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max
  },
  fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = /jpeg|jpg|png|webp|mp4|mov|avi|quicktime|pdf|msword|officedocument|text|csv|octet-stream/;
    const extMatch = /\.(jpeg|jpg|png|webp|mp4|mov|avi|pdf|doc|docx|txt|csv)$/i.test(file.originalname);
    const mimeMatch = allowed.test(file.mimetype);
    if (mimeMatch || extMatch) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: images, videos, PDF, and documents.'));
    }
  },
});

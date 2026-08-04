import multer from 'multer';

// Store uploads in memory so we can pass the buffer to EXIF extraction and Supabase Storage
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max (videos)
  },
  fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = /jpeg|jpg|png|webp|mp4|mov|avi|quicktime/;
    const mime = allowed.test(file.mimetype);
    if (mime) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: images (jpeg, png, webp) and videos (mp4, mov, avi).'));
    }
  },
});

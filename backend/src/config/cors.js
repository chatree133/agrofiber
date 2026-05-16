const baseAllowedOrigins = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/([a-z0-9-]+\.)*advanceagro\.net$/i,
  /^https?:\/\/([a-z0-9-]+\.)*advanceagro\.com$/i,
  /^https?:\/\/([a-z0-9-]+\.)*doubleapaper\.com$/i,
];

export const corsOptions = {
  origin(origin, callback) {
    if (!origin || baseAllowedOrigins.some((pattern) => pattern.test(origin))) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
};

export const logger = {
  info(meta, message) {
    if (typeof meta === 'string') {
      console.log(meta);
      return;
    }
    console.log(message, meta || {});
  },
  warn(meta, message) {
    if (typeof meta === 'string') {
      console.warn(meta);
      return;
    }
    console.warn(message, meta || {});
  },
  error(meta, message) {
    if (typeof meta === 'string') {
      console.error(meta);
      return;
    }
    console.error(message, meta || {});
  },
};


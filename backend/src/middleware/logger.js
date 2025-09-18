const onFinished = require('on-finished');

module.exports = (req, res, next) => {
  const start = process.hrtime.bigint();
  const { method, originalUrl } = req;

  onFinished(res, () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const status = res.statusCode;
    console.log(`${method} ${originalUrl} -> ${status} ${durationMs.toFixed(1)}ms`);
  });

  next();
};

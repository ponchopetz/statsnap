// middlewares/errorHandler.js

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  const status = err.status || err.statusCode || 500;
  // Only errors thrown with an explicit status carry a message written for
  // the client. Anything else (driver/library failures) stays generic so
  // internals never leak into a response.
  const message =
    status < 500 ? err.message || "Request failed" : "Internal server error";

  res.status(status).json({ message });
};

module.exports = errorHandler;

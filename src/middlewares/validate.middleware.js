module.exports = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, {
    abortEarly: false,
  });

  console.log('Validating with Schema Keys:', Object.keys(schema.describe().keys));

  if (error) {
    console.log('Validation Request Body:', JSON.stringify(req.body, null, 2));
    console.log('Validation Error:', JSON.stringify(error, null, 2));
    return res.status(400).json({
      message: 'Validation failed',
      errors: error.details.map((d) => d.message),
    });
  }

  next();
};

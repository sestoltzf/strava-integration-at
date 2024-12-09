const handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello, this is a test function!" }),
  };
};

module.exports = { handler };
^X
ls netlify/function^X
^X


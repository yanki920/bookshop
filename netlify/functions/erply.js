exports.handler = async function(event) {
  try {
    const params = JSON.parse(event.body || '{}');
    const cc = params.clientCode;
    if (!cc) return { statusCode: 400, body: 'Missing clientCode' };
    const urlParams = new URLSearchParams(params);
    const url = 'https://' + cc + '.erply.com/api/?' + urlParams.toString();
    const response = await fetch(url);
    const data = await response.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data)
    };
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

const crypto = require('crypto');
const fs = require('fs');

function huellaSha256(ruta) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(ruta)
      .on('error', reject)
      .on('data', trozo => hash.update(trozo))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

module.exports = { huellaSha256 };

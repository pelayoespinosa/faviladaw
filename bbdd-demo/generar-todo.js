const { execFileSync } = require('child_process');
const path = require('path');
for (const f of ['generar.js', 'generar-operativa.js', 'anadir-validacion.js', 'generar-documentos.js', 'generar-cuadros.js']) {
  console.log('→', f);
  execFileSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit' });
}

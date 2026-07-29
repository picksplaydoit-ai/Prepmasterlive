const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/<Route path="\/" element={<AutoRouter \/>} \/>/, '<Route path="/" element={<Navigate to="/teacher" />} />');
code = code.replace(/<Route path="\*" element={<Navigate to="\/" replace \/>} \/>/, '<Route path="*" element={<Navigate to="/teacher" />} />');

fs.writeFileSync('src/App.tsx', code);

const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

const yamlPath = path.join(__dirname, '../src/docs/agents.yaml');
let doc;
try {
  doc = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
} catch (e) {
  console.error("YAML Parse Error:", e);
  process.exit(1);
}

const errorResponse = {
  description: 'Error response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' }
            }
          }
        }
      }
    }
  }
};

for (const pathKey in doc.paths) {
  for (const methodKey in doc.paths[pathKey]) {
    const responses = doc.paths[pathKey][methodKey].responses || {};
    responses['400'] = responses['400'] || errorResponse;
    responses['401'] = responses['401'] || errorResponse;
    responses['403'] = responses['403'] || errorResponse;
    responses['404'] = responses['404'] || errorResponse;
    responses['500'] = responses['500'] || errorResponse;
    doc.paths[pathKey][methodKey].responses = responses;
  }
}

fs.writeFileSync(yamlPath, yaml.dump(doc, { noRefs: true, indent: 2 }));
console.log('Fixed agents.yaml');

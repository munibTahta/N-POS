// Central AI configuration helper
const DEFAULT_AI_MODEL = process.env.DEFAULT_AI_MODEL || 'gpt-5-mini';

function getDefaultModel() {
  return DEFAULT_AI_MODEL;
}

module.exports = { getDefaultModel, DEFAULT_AI_MODEL };

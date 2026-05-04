function looksLikeCutReply(text) {
  const value = String(text || '');
  const fenceCount = countCodeFences(value);
  if (fenceCount % 2 !== 0) return true;

  const lines = value.split('\n');
  const lastMeaningfulLine = lines.reverse().find(l => l.trim().length > 0) || '';

  return (
    lastMeaningfulLine.endsWith(',') ||
    lastMeaningfulLine.endsWith('{') ||
    lastMeaningfulLine.endsWith('(') ||
    lastMeaningfulLine.endsWith('[') ||
    lastMeaningfulLine.endsWith('\\')
  );
}

function countCodeFences(text) {
  return (String(text || '').match(/```/g) || []).length;
}

function findLastFileHeadingBefore(text, index) {
  const lines = text.slice(0, index).split('\n');
  let lastHeadingPosition = -1;
  let position = 0;

  for (const line of lines) {
    if (/^(archivo|file):/i.test(line.trim())) {
      lastHeadingPosition = position;
    }
    position += line.length + 1;
  }

  return lastHeadingPosition >= 0 ? lastHeadingPosition : index;
}

function removeIncompleteFileBlock(text) {
  const value = String(text || '');
  const fenceCount = countCodeFences(value);

  if (fenceCount % 2 === 0) return value.trim();

  const lastFenceIndex = value.lastIndexOf('```');
  const cutIndex = findLastFileHeadingBefore(value, lastFenceIndex);
  return value.slice(0, cutIndex).trim();
}

module.exports = {
  looksLikeCutReply,
  removeIncompleteFileBlock
};
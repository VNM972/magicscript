'use strict';

const fs = require('node:fs');
const path = require('node:path');

function assertRuntimeStatePath(filePath) {
  const absolutePath = path.resolve(filePath);
  const expectedDirectory = path.join('.magicscript', 'overnight').toLowerCase();
  const directory = path.dirname(absolutePath).toLowerCase();

  if (path.basename(absolutePath).toLowerCase() !== 'current.json' || !directory.endsWith(expectedDirectory)) {
    throw new Error('Overnight state must be .magicscript/overnight/current.json');
  }

  return absolutePath;
}

function writeOvernightStateAtomic(filePath, state) {
  const absolutePath = assertRuntimeStatePath(filePath);
  const directory = path.dirname(absolutePath);
  fs.mkdirSync(directory, { recursive: true });

  const temporaryPath = path.join(
    directory,
    `.current.json.${process.pid}.${Date.now()}.tmp`,
  );

  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    fs.renameSync(temporaryPath, absolutePath);
  } catch (error) {
    try {
      fs.unlinkSync(temporaryPath);
    } catch {}
    throw error;
  }

  return absolutePath;
}

function readOvernightState(filePath) {
  const absolutePath = assertRuntimeStatePath(filePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

module.exports = {
  assertRuntimeStatePath,
  readOvernightState,
  writeOvernightStateAtomic,
};

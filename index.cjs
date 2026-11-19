'use strict';

const { inspectImageFile } = require('./lib/image-meta.cjs');
const { STUDIO_CREW, STUDIO_PRESETS, getCrewList, resolvePreset, buildProductionPacks } = require('./lib/crew.cjs');
const { StudioStore, defaultStudioHome } = require('./lib/store.cjs');
const { createStudioWebServer } = require('./lib/studio-web.cjs');
const { getClientTargets, installStudioClients, checkStudioStatus } = require('./lib/installers.cjs');

module.exports = {
  inspectImageFile,
  STUDIO_CREW,
  STUDIO_PRESETS,
  getCrewList,
  resolvePreset,
  buildProductionPacks,
  StudioStore,
  defaultStudioHome,
  createStudioWebServer,
  getClientTargets,
  installStudioClients,
  checkStudioStatus
};
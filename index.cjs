'use strict';

const { inspectImageFile, classifyImageGeometry } = require('./lib/image-meta.cjs');
const { STUDIO_CREW, STUDIO_PRESETS, normalizeRoleId, getCrewList, resolvePreset, buildProductionPacks } = require('./lib/crew.cjs');
const {
  inferSubjectTypeFromHints,
  parseDirectedIntent,
  generateAutonomousProposals,
  runMultiAgentPipeline,
  evaluateQaScorecard
} = require('./lib/orchestrator.cjs');
const { detectAvailableExecutors, buildExecutorPayload, executeRenderWithProvider } = require('./lib/executors.cjs');
const { StudioStore, defaultStudioHome } = require('./lib/store.cjs');
const { createStudioWebServer } = require('./lib/studio-web.cjs');
const { getClientTargets, installStudioClients, checkStudioStatus } = require('./lib/installers.cjs');

module.exports = {
  inspectImageFile,
  classifyImageGeometry,
  STUDIO_CREW,
  STUDIO_PRESETS,
  normalizeRoleId,
  getCrewList,
  resolvePreset,
  buildProductionPacks,
  inferSubjectTypeFromHints,
  parseDirectedIntent,
  generateAutonomousProposals,
  runMultiAgentPipeline,
  evaluateQaScorecard,
  detectAvailableExecutors,
  buildExecutorPayload,
  executeRenderWithProvider,
  StudioStore,
  defaultStudioHome,
  createStudioWebServer,
  getClientTargets,
  installStudioClients,
  checkStudioStatus
};

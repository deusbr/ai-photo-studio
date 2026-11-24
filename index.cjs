'use strict';

const { inspectImageFile, classifyImageGeometry } = require('./lib/image-meta.cjs');
const { detectScreenshotCropBox, prepareCleanAnchor } = require('./lib/preprocess.cjs');
const { STUDIO_CREW, STUDIO_PRESETS, normalizeRoleId, getCrewList, resolvePreset, buildProductionPacks } = require('./lib/crew.cjs');
const { CRAFT_CATALOG } = require('./lib/craft-library.cjs');
const { searchCraftCatalog, listCraftCatalog, researchPhotographyTechniques } = require('./lib/craft-research.cjs');
const { recommendCraftStack } = require('./lib/craft-planner.cjs');
const {
  inferSubjectTypeFromHints,
  parseDirectedIntent,
  generateAutonomousProposals,
  runMultiAgentPipeline,
  evaluateQaScorecard,
  getEssayBlueprints,
  generateEssayPlan
} = require('./lib/orchestrator.cjs');
const {
  detectAvailableExecutors,
  buildExecutorPayload,
  executeRenderWithProvider,
  analyzeAnchorWithVision
} = require('./lib/executors.cjs');
const { StudioStore, defaultStudioHome } = require('./lib/store.cjs');
const { createStudioWebServer } = require('./lib/studio-web.cjs');
const { getClientTargets, installStudioClients, checkStudioStatus } = require('./lib/installers.cjs');

module.exports = {
  inspectImageFile,
  classifyImageGeometry,
  detectScreenshotCropBox,
  prepareCleanAnchor,
  STUDIO_CREW,
  STUDIO_PRESETS,
  CRAFT_CATALOG,
  searchCraftCatalog,
  listCraftCatalog,
  researchPhotographyTechniques,
  recommendCraftStack,
  normalizeRoleId,
  getCrewList,
  resolvePreset,
  buildProductionPacks,
  inferSubjectTypeFromHints,
  parseDirectedIntent,
  generateAutonomousProposals,
  runMultiAgentPipeline,
  evaluateQaScorecard,
  getEssayBlueprints,
  generateEssayPlan,
  detectAvailableExecutors,
  buildExecutorPayload,
  executeRenderWithProvider,
  analyzeAnchorWithVision,
  StudioStore,
  defaultStudioHome,
  createStudioWebServer,
  getClientTargets,
  installStudioClients,
  checkStudioStatus
};

declare const __MINDMAP_GIT_COMMIT_SHA__: string;
declare const __MINDMAP_GIT_DIRTY__: boolean;

const commitSha =
  typeof __MINDMAP_GIT_COMMIT_SHA__ === "string"
    ? __MINDMAP_GIT_COMMIT_SHA__
    : "unversioned";
const dirty =
  typeof __MINDMAP_GIT_DIRTY__ === "boolean"
    ? __MINDMAP_GIT_DIRTY__
    : true;

export const BUILD_METADATA = Object.freeze({
  repository: "ne-agalakov/mindmap-local",
  commitSha,
  dirty,
});

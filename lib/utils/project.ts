export function getOwnerId(projectData: any): string | undefined {
  return Array.isArray(projectData)
    ? projectData[0]?.owner_id
    : projectData?.owner_id;
}
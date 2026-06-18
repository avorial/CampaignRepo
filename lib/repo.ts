export function parseRepoInput(owner: string, repo: string) {
  const cleanOwner = owner.trim();
  let cleanRepo = repo.trim();
  const match = /github\.com[/:]([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[?#].*)?$/i.exec(cleanRepo);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  cleanRepo = cleanRepo.replace(/\.git$/i, "");
  return { owner: cleanOwner, repo: cleanRepo };
}

const kineticRows = [
  ["CAMPAIGNREPO", "LORE", "CANON"],
  ["MAPS", "NPCS", "SESSIONS"],
  ["QUESTS", "FACTIONS", "TIMELINE"],
  ["ARTIFACTS", "REALMS", "SECRETS"],
  ["ENCOUNTERS", "CHRONICLE", "HEROES"],
  ["CAMPAIGNREPO", "MAPS", "CANON"]
];

export default function KineticBackground() {
  return (
    <div className="auth-kinetic" aria-hidden="true">
      <div className="auth-kinetic-stack">
        {kineticRows.map((row, rowIndex) => (
          <div className={`auth-kinetic-row ${rowIndex % 2 ? "auth-kinetic-reverse" : ""}`} key={row.join("-")}>
            {[...row, ...row].map((word, wordIndex) => (
              <span className={wordIndex % 2 ? "auth-kinetic-outline" : "auth-kinetic-fill"} key={`${word}-${wordIndex}`}>
                {word}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

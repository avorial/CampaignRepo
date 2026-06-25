import type { GameType } from "@/lib/types";

export const gamePackCategory: Record<GameType, "Fantasy" | "Modern" | "Sci-Fi" | "Generic"> = {
  "Blades in the Dark": "Fantasy",
  "Burning Wheel": "Fantasy",
  "Dark Ages: Fae": "Fantasy",
  "Dark Ages: Inquisitor": "Fantasy",
  "Dark Ages: Mage": "Fantasy",
  "Dark Ages: Vampire": "Fantasy",
  "Dark Ages: Werewolf": "Fantasy",
  Dragonbane: "Fantasy",
  "Dungeons & Dragons": "Fantasy",
  "Fabula Ultima": "Fantasy",
  "Mörk Borg": "Fantasy",
  "Old-School Essentials": "Fantasy",
  Pathfinder: "Fantasy",
  Pendragon: "Fantasy",
  Reign: "Fantasy",
  "Shadowdark RPG": "Fantasy",
  "Sword Chronicle": "Fantasy",
  "The One Ring": "Fantasy",
  "Warhammer Fantasy Roleplay": "Fantasy",
  "Call of Cthulhu": "Modern",
  "Candela Obscura": "Modern",
  "Changeling: The Dreaming": "Modern",
  "Delta Green": "Modern",
  "Demon: The Fallen": "Modern",
  "Hunter: The Reckoning": "Modern",
  "Mage: The Ascension": "Modern",
  "Mummy: The Resurrection": "Modern",
  "The King in Yellow RPG": "Modern",
  "Twilight: 2000": "Modern",
  "Vampire: The Masquerade": "Modern",
  "Werewolf: The Apocalypse": "Modern",
  "Wraith: The Oblivion": "Modern",
  "2300AD": "Sci-Fi",
  "Alien RPG": "Sci-Fi",
  Coriolis: "Sci-Fi",
  "Cyberpunk RED": "Sci-Fi",
  Mothership: "Sci-Fi",
  Starfinder: "Sci-Fi",
  Traveller: "Sci-Fi",
  "Warhammer 40,000 Roleplay": "Sci-Fi",
  "Fate Core": "Generic",
  "Savage Worlds": "Generic",
  Custom: "Generic"
};

const categoryTheme = {
  Fantasy: "fantasy",
  Modern: "horror",
  "Sci-Fi": "scifi",
  Generic: "generic"
} as const;

export const themePresetNames = ["", "fantasy", "horror", "scifi", "generic", "traveller", "vampire", "mage"] as const;
export type ThemePreset = typeof themePresetNames[number];

export const themePresetLabels: Record<ThemePreset, string> = {
  "": "Base (CampaignRepo)",
  fantasy: "Fantasy",
  horror: "Modern / occult",
  scifi: "Sci-Fi",
  generic: "Generic",
  traveller: "Traveller - flagship",
  vampire: "Vampire - flagship",
  mage: "Mage - flagship"
};

export function themePresetForGame(gameType: GameType): ThemePreset {
  if (gameType === "Traveller") return "traveller";
  if (gameType === "Vampire: The Masquerade") return "vampire";
  if (gameType === "Mage: The Ascension") return "mage";
  return categoryTheme[gamePackCategory[gameType]];
}

const worldOfDarknessLogo = "/brand/logo-world-of-darkness.png";

export const gamePackLogos: Partial<Record<GameType, string>> = {
  "Blades in the Dark": "/brand/logo-blades-in-the-dark.png",
  "Burning Wheel": "/brand/logo-burning-wheel.png",
  "Dark Ages: Fae": worldOfDarknessLogo,
  "Dark Ages: Inquisitor": worldOfDarknessLogo,
  "Dark Ages: Mage": worldOfDarknessLogo,
  "Dark Ages: Vampire": "/brand/logo-dark-ages-vampire.png",
  "Dark Ages: Werewolf": worldOfDarknessLogo,
  Dragonbane: "/brand/logo-dragonbane.png",
  "Dungeons & Dragons": "/brand/logo-dnd.png",
  "Fabula Ultima": "/brand/logo-fabula-ultima.png",
  "Mörk Borg": "/brand/logo-mork-borg.png",
  "Old-School Essentials": "/brand/logo-old-school-essentials.png",
  Pathfinder: "/brand/logo-pathfinder.png",
  Pendragon: "/brand/logo-pendragon.png",
  Reign: "/brand/logo-reign.png",
  "Shadowdark RPG": "/brand/logo-shadowdark.png",
  "Sword Chronicle": "/brand/logo-chronicle-system.png",
  "The One Ring": "/brand/logo-one-ring.png",
  "Warhammer Fantasy Roleplay": "/brand/logo-warhammer-fantasy.png",
  "Call of Cthulhu": "/brand/logo-call-of-cthulhu.png",
  "Candela Obscura": "/brand/logo-candela-obscura.png",
  "Changeling: The Dreaming": "/brand/logo-changeling.png",
  "Delta Green": "/brand/logo-delta-green.png",
  "Demon: The Fallen": "/brand/logo-demon-the-fallen.png",
  "Hunter: The Reckoning": worldOfDarknessLogo,
  "Mage: The Ascension": "/brand/logo-mage-ascension.png",
  "Mummy: The Resurrection": "/brand/logo-mummy-resurrection.png",
  "The King in Yellow RPG": "/brand/logo-king-in-yellow.png",
  "Twilight: 2000": "/brand/logo-twilight-2000.png",
  "Vampire: The Masquerade": "/brand/logo-vampire-masquerade.png",
  "Werewolf: The Apocalypse": "/brand/logo-werewolf-apocalypse.png",
  "Wraith: The Oblivion": "/brand/logo-wraith-oblivion.png",
  "2300AD": "/brand/logo-2300ad.png",
  "Alien RPG": "/brand/logo-alien-rpg.png",
  Coriolis: "/brand/logo-coriolis.png",
  "Cyberpunk RED": "/brand/logo-cyberpunk-red.png",
  Mothership: "/brand/logo-mothership.png",
  Starfinder: "/brand/logo-starfinder.png",
  Traveller: "/brand/logo-traveller.png",
  "Warhammer 40,000 Roleplay": "/brand/logo-warhammer-40k.png",
  "Fate Core": "/brand/logo-fate-core.png",
  "Savage Worlds": "/brand/logo-savage-worlds.png",
  Custom: "/brand/logo-dice.png"
};

export const darkPlatePacks = new Set<GameType>(["2300AD", "Alien RPG", "Fabula Ultima", "Mage: The Ascension", "Mothership", "The One Ring", "Custom"]);

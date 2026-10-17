/**
 * "Good Luck, NYC" lookbook: real street photos and where each tee sits in them.
 * Hotspot x/y are percentages of the photo (left/top), placed on the print. A colorway is
 * set only when the shirt in the photo is one the store sells, so the link opens on it.
 */
export interface LookbookHotspot {
  x: number;
  y: number;
  productId: string;
  colorway?: string;
}

export interface LookbookScene {
  id: string;
  src: string;
  width: number;
  height: number;
  place: { en: string; es: string };
  /** Short alt text describing the photo */
  alt: { en: string; es: string };
  hotspots: LookbookHotspot[];
}

export const NYC_LOOKBOOK: LookbookScene[] = [
  {
    id: "times-square",
    src: "/lookbook/time-square.png",
    width: 896,
    height: 1200,
    place: { en: "Times Square", es: "Times Square" },
    alt: {
      en: "Two friends walking through Times Square in Good Luck tees: Eagle Clover on black and Eight Ball on blue",
      es: "Dos amigos caminando por Times Square con playeras Good Luck: Eagle Clover en negro y Eight Ball en azul",
    },
    hotspots: [
      { x: 31, y: 50, productId: "eagle-clover-tee", colorway: "washed-black" },
      { x: 71, y: 49, productId: "eight-ball-tee" },
    ],
  },
  {
    id: "brooklyn-bridge",
    src: "/lookbook/brooklyn-bridge.png",
    width: 896,
    height: 1200,
    place: { en: "Brooklyn Bridge", es: "Puente de Brooklyn" },
    alt: {
      en: "Two friends crossing the Brooklyn Bridge in Good Luck tees: Eagle Clover on black and Eight Ball on blue",
      es: "Dos amigos cruzando el Puente de Brooklyn con playeras Good Luck: Eagle Clover en negro y Eight Ball en azul",
    },
    hotspots: [
      { x: 35, y: 46, productId: "eagle-clover-tee", colorway: "washed-black" },
      { x: 69, y: 47, productId: "eight-ball-tee" },
    ],
  },
  {
    id: "bronx",
    src: "/lookbook/bronx.png",
    width: 896,
    height: 1200,
    place: { en: "The Bronx", es: "El Bronx" },
    alt: {
      en: "Four friends on the Grand Concourse in the Bronx wearing Good Luck tees",
      es: "Cuatro amigos en el Grand Concourse del Bronx con playeras Good Luck",
    },
    hotspots: [
      { x: 19, y: 50, productId: "eagle-clover-tee", colorway: "washed-black" },
      { x: 62, y: 51, productId: "boxing-gloves-tee" },
      { x: 84, y: 52, productId: "eight-ball-tee" },
    ],
  },
];

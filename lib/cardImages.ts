export type ScryfallImageUris = { normal?: string; small?: string };
export type ScryfallFace = { image_uris?: ScryfallImageUris };
export type ScryfallImageCard = { image_uris?: ScryfallImageUris; card_faces?: ScryfallFace[] };

export function getCardFaceImages(card: ScryfallImageCard) {
  const front = card.image_uris?.normal || card.image_uris?.small || card.card_faces?.[0]?.image_uris?.normal || card.card_faces?.[0]?.image_uris?.small || null;
  const back = card.card_faces?.[1]?.image_uris?.normal || card.card_faces?.[1]?.image_uris?.small || null;
  return { front, back };
}

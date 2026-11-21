/** Plain-English names for Overture category labels: [one, many]. */
const NAMES: Record<string, [string, string]> = {
  animal_and_pet_store: ["pet store", "pet stores"],
  animal_or_pet_service: ["pet service (vets, groomers, sitters)", "pet services (vets, groomers, sitters)"],
  b2b_office_and_professional_service: ["professional-services office", "professional-services offices"],
  bar: ["bar", "bars"],
  cafe: ["cafe", "cafes"],
  coffee_shop: ["coffee shop", "coffee shops"],
  college_university: ["college or university site", "college and university sites"],
  convenience_store: ["convenience store", "convenience stores"],
  corporate_or_business_office: ["company office", "company offices"],
  dance_club: ["dance club", "dance clubs"],
  department_store: ["department store", "department stores"],
  dog_park: ["dog park", "dog parks"],
  elementary_school: ["elementary school", "elementary schools"],
  event_venue: ["event venue", "event venues"],
  fashion_and_apparel_store: ["clothing store", "clothing stores"],
  fast_food_restaurant: ["fast-food restaurant", "fast-food restaurants"],
  festival_venue: ["festival venue", "festival venues"],
  fitness_studio: ["fitness studio", "fitness studios"],
  food_truck_stand: ["food truck", "food trucks"],
  gym: ["gym", "gyms"],
  lounge: ["lounge", "lounges"],
  music_venue: ["music venue", "music venues"],
  nightlife_venue: ["nightlife venue", "nightlife venues"],
  park: ["park", "parks"],
  pediatric_clinic: ["pediatric clinic", "pediatric clinics"],
  personal_care_and_beauty_store: ["beauty store", "beauty stores"],
  personal_or_beauty_service: ["salon or beauty service", "salons and beauty services"],
  pharmacy_and_drug_store: ["pharmacy", "pharmacies"],
  playground: ["playground", "playgrounds"],
  preschool: ["preschool", "preschools"],
  shopping_mall: ["shopping mall", "shopping malls"],
  smoothie_juice_bar: ["juice bar", "juice bars"],
  sport_court: ["sports court", "sports courts"],
  sport_or_fitness_facility: ["sports or fitness facility", "sports and fitness facilities"],
  sporting_goods_store: ["sporting-goods store", "sporting-goods stores"],
  swimming_pool: ["swimming pool", "swimming pools"],
  toys_and_games_store: ["toy store", "toy stores"],
  wellness_service: ["wellness service (spas, massage)", "wellness services (spas, massage)"],
};

export function labelName(label: string, count = 2): string {
  const n = NAMES[label] ?? [label.replace(/_/g, " "), label.replace(/_/g, " ")];
  return count === 1 ? n[0] : n[1];
}

/** "31 gyms", "1 pet store", "no toy stores". */
export function countPhrase(label: string, count: number): string {
  return count === 0 ? `no ${labelName(label)}` : `${count.toLocaleString("en-US")} ${labelName(label, count)}`;
}

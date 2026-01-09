export interface WeekData {
  week: number;
  size: string;
  sizeEmoji: string;
  length: string;
  weight: string;
  developments: string[];
  funFacts: string[];
  trimester: 1 | 2 | 3;
}

export const pregnancyData: Record<number, WeekData> = {
  1: {
    week: 1,
    size: "not yet conceived",
    sizeEmoji: "🌸",
    length: "-",
    weight: "-",
    developments: [
      "Your body is preparing for ovulation. The uterine lining is building up to welcome a fertilized egg.",
      "Hormones are signaling your ovaries to prepare an egg for release.",
      "The uterus is creating a nutrient-rich environment for potential implantation.",
    ],
    funFacts: [
      "Week 1 is counted from the first day of your last period, even though conception hasn't happened yet!",
      "Pregnancy is dated from the last menstrual period because ovulation timing varies.",
      "Your body has about 1-2 million eggs, but only about 400 will ever be released during your lifetime.",
    ],
    trimester: 1,
  },
  2: {
    week: 2,
    size: "not yet conceived",
    sizeEmoji: "🌸",
    length: "-",
    weight: "-",
    developments: [
      "Ovulation occurs this week. An egg is released and ready to meet sperm.",
      "The egg travels down the fallopian tube where fertilization may occur.",
      "Your cervical mucus changes to help sperm travel more easily.",
    ],
    funFacts: [
      "The egg only survives 12-24 hours after ovulation, but sperm can wait up to 5 days.",
      "Of the millions of sperm released, only about 200 will reach the egg.",
      "The sex of your baby is determined at the moment of fertilization by the sperm.",
    ],
    trimester: 1,
  },
  3: {
    week: 3,
    size: "poppy seed",
    sizeEmoji: "🫛",
    length: "tiny",
    weight: "-",
    developments: [
      "Fertilization happens! The sperm and egg unite to form a zygote that begins dividing rapidly.",
      "The fertilized egg travels through the fallopian tube toward the uterus.",
      "Cell division begins immediately, doubling every 12-24 hours.",
    ],
    funFacts: [
      "At conception, your baby's entire genetic makeup is already determined, including eye color and sex.",
      "The zygote contains 46 chromosomes - 23 from each parent.",
      "By the end of this week, the single cell has divided into about 100 cells.",
    ],
    trimester: 1,
  },
  4: {
    week: 4,
    size: "poppy seed",
    sizeEmoji: "🫛",
    length: "0.04 in",
    weight: "-",
    developments: [
      "The blastocyst implants in the uterine wall. The placenta begins forming.",
      "The embryo splits into two layers that will become all of baby's organs.",
      "The amniotic sac and yolk sac start developing.",
    ],
    funFacts: [
      "The embryo is now producing hCG, the hormone detected by pregnancy tests!",
      "Implantation bleeding may occur as the embryo burrows into the uterine lining.",
      "The placenta will eventually be the size of a dinner plate.",
    ],
    trimester: 1,
  },
  5: {
    week: 5,
    size: "sesame seed",
    sizeEmoji: "🌱",
    length: "0.08 in",
    weight: "-",
    developments: [
      "The neural tube (future brain and spinal cord) is forming. The heart begins to develop.",
      "Three layers of cells form: ectoderm, mesoderm, and endoderm - the foundation for all organs.",
      "The circulatory system is the first major system to function.",
    ],
    funFacts: [
      "Your baby's heart will start beating this week, though it's too early to hear.",
      "The heart beats about 100-160 times per minute - twice as fast as yours!",
      "Folate is crucial now as the neural tube closes during weeks 5-6.",
    ],
    trimester: 1,
  },
  6: {
    week: 6,
    size: "lentil",
    sizeEmoji: "🟤",
    length: "0.2 in",
    weight: "-",
    developments: [
      "The heart is beating about 110 times per minute. Facial features begin forming.",
      "Tiny buds that will become arms and legs are appearing.",
      "The brain is developing into five distinct areas.",
    ],
    funFacts: [
      "Your baby now has a tiny tail that will disappear as the spine develops!",
      "The embryo is shaped like a tiny seahorse at this stage.",
      "Dark spots mark where the eyes and nostrils will form.",
    ],
    trimester: 1,
  },
  7: {
    week: 7,
    size: "blueberry",
    sizeEmoji: "🫐",
    length: "0.4 in",
    weight: "-",
    developments: [
      "Arms and legs are forming as small buds. The brain is growing rapidly.",
      "The digestive system and lungs are beginning to develop.",
      "The mouth and tongue are forming.",
    ],
    funFacts: [
      "Your baby has doubled in size since last week!",
      "The embryo is generating about 100 new brain cells every minute.",
      "Tiny webbed fingers are starting to form on the hand paddles.",
    ],
    trimester: 1,
  },
  8: {
    week: 8,
    size: "raspberry",
    sizeEmoji: "🍇",
    length: "0.6 in",
    weight: "0.04 oz",
    developments: [
      "Fingers and toes are forming. The intestines are developing in the umbilical cord.",
      "The upper lip and nose have formed. Eyelids are developing.",
      "The retinas are beginning to develop pigment.",
    ],
    funFacts: [
      "Your baby is constantly moving, though you can't feel it yet.",
      "The tail has almost completely disappeared.",
      "Taste buds are beginning to form on the tongue.",
    ],
    trimester: 1,
  },
  9: {
    week: 9,
    size: "cherry",
    sizeEmoji: "🍒",
    length: "0.9 in",
    weight: "0.07 oz",
    developments: [
      "All essential organs have begun forming. The tail has disappeared completely.",
      "Muscles are developing and the baby can make small movements.",
      "The heart has divided into four chambers.",
    ],
    funFacts: [
      "Your baby officially graduates from embryo to fetus this week!",
      "The baby now has earlobes.",
      "Individual fingers and toes are now distinct, no longer webbed.",
    ],
    trimester: 1,
  },
  10: {
    week: 10,
    size: "strawberry",
    sizeEmoji: "🍓",
    length: "1.2 in",
    weight: "0.14 oz",
    developments: [
      "Bones and cartilage are forming. The vital organs are fully developed and starting to function.",
      "The baby can bend their limbs at the elbows and knees.",
      "Fingernails and toenails are beginning to develop.",
    ],
    funFacts: [
      "Tiny tooth buds are forming under the gums.",
      "The baby can now swallow and kick, though too small to feel.",
      "The stomach is producing digestive juices and the kidneys are producing urine.",
    ],
    trimester: 1,
  },
  11: {
    week: 11,
    size: "lime",
    sizeEmoji: "🍋",
    length: "1.6 in",
    weight: "0.25 oz",
    developments: [
      "The baby can open and close their fists. Hair follicles are forming.",
      "Bones are beginning to harden and the spine is visible.",
      "The diaphragm is developing, which may cause hiccups!",
    ],
    funFacts: [
      "Your baby's head makes up about half of their entire length!",
      "Facial features are becoming more defined and human-looking.",
      "The baby has a 1 in 2 chance of being a thumb-sucker.",
    ],
    trimester: 1,
  },
  12: {
    week: 12,
    size: "plum",
    sizeEmoji: "🫐",
    length: "2.1 in",
    weight: "0.5 oz",
    developments: [
      "Reflexes are developing. The baby can suck and swallow. Fingernails are forming.",
      "The pituitary gland is producing hormones.",
      "The digestive system is practicing contraction movements.",
    ],
    funFacts: [
      "Your baby's vocal cords are beginning to form this week!",
      "The risk of miscarriage drops significantly after week 12.",
      "The baby's face looks fully human now.",
    ],
    trimester: 1,
  },
  13: {
    week: 13,
    size: "peach",
    sizeEmoji: "🍑",
    length: "2.8 in",
    weight: "0.8 oz",
    developments: [
      "Vocal cords are developing. The intestines move from umbilical cord into the abdomen.",
      "Unique fingerprints are forming.",
      "The baby can put their thumb in their mouth.",
    ],
    funFacts: [
      "Welcome to the second trimester! Many women feel more energetic now.",
      "The placenta is now fully functioning and providing nutrients.",
      "If you're having a girl, she already has over 2 million eggs in her ovaries.",
    ],
    trimester: 2,
  },
  14: {
    week: 14,
    size: "lemon",
    sizeEmoji: "🍋",
    length: "3.3 in",
    weight: "1.5 oz",
    developments: [
      "The baby can squint, frown, and grimace. The liver starts producing bile.",
      "The roof of the mouth is completely formed.",
      "Lanugo (fine hair) is starting to cover the body.",
    ],
    funFacts: [
      "Your baby's fingerprints are fully formed and unique!",
      "The baby may start practicing breathing movements this week.",
      "Boys and girls start to look different on ultrasound now.",
    ],
    trimester: 2,
  },
  15: {
    week: 15,
    size: "apple",
    sizeEmoji: "🍎",
    length: "4 in",
    weight: "2.5 oz",
    developments: [
      "The baby is forming taste buds and can sense light through closed eyelids.",
      "The skeleton is developing and can be seen on ultrasound.",
      "The baby is moving amniotic fluid through their nose and upper respiratory tract.",
    ],
    funFacts: [
      "Your baby is now practicing breathing movements with amniotic fluid.",
      "The baby can sense bright light from outside the womb.",
      "Legs are now longer than the arms.",
    ],
    trimester: 2,
  },
  16: {
    week: 16,
    size: "avocado",
    sizeEmoji: "🥑",
    length: "4.5 in",
    weight: "3.5 oz",
    developments: [
      "The skeletal system continues hardening. Eyes are moving into position.",
      "The circulatory system is fully functional.",
      "The baby can make sucking motions with their mouth.",
    ],
    funFacts: [
      "Some women start feeling quickening - the first fluttery movements!",
      "The baby's heart pumps about 25 quarts of blood per day.",
      "The umbilical cord is now fully formed with one vein and two arteries.",
    ],
    trimester: 2,
  },
  17: {
    week: 17,
    size: "pear",
    sizeEmoji: "🍐",
    length: "5.1 in",
    weight: "5 oz",
    developments: [
      "Fat stores begin developing. The umbilical cord is growing stronger.",
      "Sweat glands are developing.",
      "The baby can move all of their joints.",
    ],
    funFacts: [
      "Your baby can now hear your voice and heartbeat!",
      "The placenta is almost as big as the baby now.",
      "Cartilage throughout the body is turning to bone.",
    ],
    trimester: 2,
  },
  18: {
    week: 18,
    size: "bell pepper",
    sizeEmoji: "🫑",
    length: "5.5 in",
    weight: "6.7 oz",
    developments: [
      "Ears move to final position. The baby is yawning and hiccupping.",
      "Myelin is forming around the nerves, a process that continues until first birthday.",
      "The baby can hear sounds and may startle at loud noises.",
    ],
    funFacts: [
      "If you're having a girl, her uterus and fallopian tubes are now in place.",
      "Your baby's hearing is well developed enough to hear your heartbeat.",
      "The baby sleeps and wakes in regular cycles.",
    ],
    trimester: 2,
  },
  19: {
    week: 19,
    size: "mango",
    sizeEmoji: "🥭",
    length: "6 in",
    weight: "8.5 oz",
    developments: [
      "A protective coating called vernix caseosa covers the skin.",
      "The sensory areas of the brain are developing rapidly.",
      "Hair is beginning to grow on the head.",
    ],
    funFacts: [
      "Your baby's brain is designating specialized areas for smell, taste, hearing, vision, and touch.",
      "The vernix protects the skin from becoming waterlogged in amniotic fluid.",
      "Girls already have about 6 million primitive egg cells.",
    ],
    trimester: 2,
  },
  20: {
    week: 20,
    size: "banana",
    sizeEmoji: "🍌",
    length: "10 in",
    weight: "10.6 oz",
    developments: [
      "You're halfway there! The baby can hear sounds outside the womb.",
      "The skin is thickening and developing layers.",
      "The baby swallows more amniotic fluid for hydration and nutrition practice.",
    ],
    funFacts: [
      "This week's anatomy scan can often reveal if you're having a boy or girl!",
      "From now on, the baby is measured head to heel, not head to rump.",
      "The baby produces meconium - their first poop - in their intestines.",
    ],
    trimester: 2,
  },
  21: {
    week: 21,
    size: "carrot",
    sizeEmoji: "🥕",
    length: "10.5 in",
    weight: "12.7 oz",
    developments: [
      "The baby's movements become more coordinated. Eyebrows and eyelids are fully formed.",
      "The tongue is fully developed.",
      "The baby is developing a sense of touch.",
    ],
    funFacts: [
      "Your baby now has a regular sleep and wake cycle.",
      "The baby can taste what you eat through the amniotic fluid.",
      "Rapid eye movements may begin, suggesting the baby can dream.",
    ],
    trimester: 2,
  },
  22: {
    week: 22,
    size: "papaya",
    sizeEmoji: "🍈",
    length: "11 in",
    weight: "15 oz",
    developments: [
      "The lips and eyelids are more distinct. The eyes have formed but lack color.",
      "The grip is getting stronger.",
      "The inner ear is now fully developed, giving a sense of position.",
    ],
    funFacts: [
      "Your baby looks like a miniature newborn now!",
      "The baby's lips are becoming more distinct.",
      "Eye color won't be determined until a few months after birth.",
    ],
    trimester: 2,
  },
  23: {
    week: 23,
    size: "grapefruit",
    sizeEmoji: "🍊",
    length: "11.4 in",
    weight: "1.1 lbs",
    developments: [
      "The baby can hear loud sounds and may react to music. Skin is still translucent.",
      "Blood vessels in the lungs are developing for breathing.",
      "The pancreas is developing steadily.",
    ],
    funFacts: [
      "Your baby is starting to develop a sense of movement and may respond when you walk or dance!",
      "Babies born at 23 weeks have a survival rate of about 20-35%.",
      "The baby can recognize your voice and may move in response.",
    ],
    trimester: 2,
  },
  24: {
    week: 24,
    size: "cantaloupe",
    sizeEmoji: "🍈",
    length: "11.8 in",
    weight: "1.3 lbs",
    developments: [
      "The inner ear is fully developed, giving baby a sense of balance.",
      "The lungs are developing surfactant, needed for breathing outside the womb.",
      "Taste buds are fully functioning.",
    ],
    funFacts: [
      "The baby's face is almost fully formed and very cute!",
      "This is considered the age of viability - baby could survive outside the womb with medical help.",
      "The baby can tell when they're upside down or right-side up.",
    ],
    trimester: 2,
  },
  25: {
    week: 25,
    size: "cauliflower",
    sizeEmoji: "🥦",
    length: "13.4 in",
    weight: "1.5 lbs",
    developments: [
      "Baby is growing more hair. The nose begins working as the nostrils open.",
      "The lungs continue to mature with increasing blood vessels.",
      "The baby is developing the ability to hold temperature.",
    ],
    funFacts: [
      "Your baby responds to your voice and may turn toward familiar sounds.",
      "The baby's hands are now fully developed.",
      "Skin is becoming less translucent as fat accumulates.",
    ],
    trimester: 2,
  },
  26: {
    week: 26,
    size: "lettuce head",
    sizeEmoji: "🥬",
    length: "13.8 in",
    weight: "1.7 lbs",
    developments: [
      "Eyes begin to open. The brain is developing rapidly with more neural connections.",
      "Air sacs in the lungs are developing.",
      "The immune system is absorbing antibodies from you.",
    ],
    funFacts: [
      "Your baby can now see, though vision is still blurry!",
      "The baby's brain waves show response to touch.",
      "Eyelashes have fully grown in.",
    ],
    trimester: 2,
  },
  27: {
    week: 27,
    size: "cabbage",
    sizeEmoji: "🥬",
    length: "14.2 in",
    weight: "1.9 lbs",
    developments: [
      "The brain continues rapid growth. Baby sleeps and wakes at regular intervals.",
      "The baby can now open and close their eyes.",
      "The lungs are capable of breathing air, though not fully mature.",
    ],
    funFacts: [
      "Welcome to the third trimester! The home stretch begins.",
      "The baby hiccups regularly, which you might feel.",
      "The retina has developed enough to detect light.",
    ],
    trimester: 3,
  },
  28: {
    week: 28,
    size: "eggplant",
    sizeEmoji: "🍆",
    length: "14.6 in",
    weight: "2.2 lbs",
    developments: [
      "Baby can blink and has eyelashes. Brain wave activity shows dream cycles (REM sleep).",
      "The nervous system is developed enough to control body temperature.",
      "Muscle tone is improving.",
    ],
    funFacts: [
      "Your baby is dreaming! REM sleep has been detected.",
      "Babies born now have a 90%+ survival rate.",
      "The baby may turn toward a bright light source.",
    ],
    trimester: 3,
  },
  29: {
    week: 29,
    size: "butternut squash",
    sizeEmoji: "🎃",
    length: "15 in",
    weight: "2.5 lbs",
    developments: [
      "Muscles and lungs continue maturing. The baby is getting stronger kicks.",
      "The head is growing to accommodate the rapidly developing brain.",
      "The baby is now controlling their own body temperature.",
    ],
    funFacts: [
      "Your baby's bones are fully developed but still soft and pliable.",
      "The baby is getting more cramped and movements may feel different.",
      "Brain surface is becoming wrinkled to allow more brain cells.",
    ],
    trimester: 3,
  },
  30: {
    week: 30,
    size: "cucumber",
    sizeEmoji: "🥒",
    length: "15.7 in",
    weight: "2.9 lbs",
    developments: [
      "The brain is growing quickly, developing grooves and folds. Vision is improving.",
      "The bone marrow is now producing red blood cells.",
      "The lanugo (fine body hair) is beginning to disappear.",
    ],
    funFacts: [
      "Your baby can distinguish between light and dark now.",
      "The baby is gaining about half a pound per week.",
      "Your baby has about a pint of amniotic fluid around them.",
    ],
    trimester: 3,
  },
  31: {
    week: 31,
    size: "coconut",
    sizeEmoji: "🥥",
    length: "16.1 in",
    weight: "3.3 lbs",
    developments: [
      "All five senses are working. The baby is processing information and signals.",
      "The baby can turn their head from side to side.",
      "The reproductive system continues developing.",
    ],
    funFacts: [
      "Your baby can turn their head from side to side.",
      "The baby might react to loud sounds with a startle reflex.",
      "Brain connections are forming at a rapid pace.",
    ],
    trimester: 3,
  },
  32: {
    week: 32,
    size: "squash",
    sizeEmoji: "🎃",
    length: "16.5 in",
    weight: "3.7 lbs",
    developments: [
      "Toenails and fingernails have grown in. Baby practices breathing movements.",
      "The skin is becoming soft and smooth as fat builds up.",
      "The baby is swallowing amniotic fluid and urinating regularly.",
    ],
    funFacts: [
      "The baby is sleeping 90-95% of the day!",
      "Your baby can now focus on large objects nearby.",
      "Most babies are in the head-down position by now.",
    ],
    trimester: 3,
  },
  33: {
    week: 33,
    size: "pineapple",
    sizeEmoji: "🍍",
    length: "16.9 in",
    weight: "4.2 lbs",
    developments: [
      "The skull bones are soft and not yet fused for easier delivery.",
      "The baby is rapidly accumulating fat.",
      "Coordination is improving.",
    ],
    funFacts: [
      "Your baby can detect light and their pupils can constrict and dilate.",
      "The skull bones will remain flexible until after puberty.",
      "The baby drinks about a pint of amniotic fluid a day.",
    ],
    trimester: 3,
  },
  34: {
    week: 34,
    size: "cantaloupe",
    sizeEmoji: "🍈",
    length: "17.7 in",
    weight: "4.6 lbs",
    developments: [
      "The lungs and central nervous system are continuing to mature.",
      "The protective vernix coating is thickening.",
      "Male babies' testicles are descending.",
    ],
    funFacts: [
      "Babies born now usually do very well with minimal medical intervention.",
      "The baby has developed their own immune system.",
      "Fingernails have reached the fingertips.",
    ],
    trimester: 3,
  },
  35: {
    week: 35,
    size: "honeydew melon",
    sizeEmoji: "🍈",
    length: "18.1 in",
    weight: "5.3 lbs",
    developments: [
      "Most physical development is complete. Baby is gaining about half a pound per week.",
      "The kidneys are fully developed.",
      "The liver can process waste products.",
    ],
    funFacts: [
      "Your baby's hearing is fully developed - talk and sing to them!",
      "The baby is running out of room for somersaults.",
      "Fat now makes up about 15% of the baby's body weight.",
    ],
    trimester: 3,
  },
  36: {
    week: 36,
    size: "romaine lettuce",
    sizeEmoji: "🥬",
    length: "18.5 in",
    weight: "5.7 lbs",
    developments: [
      "Baby may drop lower into your pelvis. Vernix coating begins to shed.",
      "The digestive system is ready to work.",
      "The gums are rigid.",
    ],
    funFacts: [
      "Your baby is now considered early term!",
      "The baby sheds most of their lanugo and vernix into the amniotic fluid.",
      "Babies swallow their shed skin cells - it's part of their first poop!",
    ],
    trimester: 3,
  },
  37: {
    week: 37,
    size: "winter melon",
    sizeEmoji: "🍈",
    length: "18.9 in",
    weight: "6.4 lbs",
    developments: [
      "The baby is practicing inhaling and exhaling amniotic fluid.",
      "The brain and lungs are still maturing.",
      "Fat continues to accumulate, especially around the elbows and knees.",
    ],
    funFacts: [
      "Your baby is officially full term! They could arrive any day.",
      "The average baby at birth is 7.5 pounds and 20 inches.",
      "The baby's intestines are filled with meconium.",
    ],
    trimester: 3,
  },
  38: {
    week: 38,
    size: "leek",
    sizeEmoji: "🥬",
    length: "19.3 in",
    weight: "6.6 lbs",
    developments: [
      "The brain and lungs continue to mature. Baby has a firm grasp.",
      "All organs are fully developed and ready to function.",
      "The baby is producing surfactant to help lungs function after birth.",
    ],
    funFacts: [
      "Your baby has lost most of the lanugo (fine hair) that covered their body.",
      "The baby has about 15% body fat now.",
      "Your baby's eye color at birth may not be their final eye color.",
    ],
    trimester: 3,
  },
  39: {
    week: 39,
    size: "watermelon",
    sizeEmoji: "🍉",
    length: "19.7 in",
    weight: "7 lbs",
    developments: [
      "Baby is full-term and ready for birth. Still building fat layers for temperature regulation.",
      "The lungs are mature and ready for their first breath.",
      "The baby's brain is still rapidly developing - and will continue after birth.",
    ],
    funFacts: [
      "The placenta provides antibodies to help protect baby after birth.",
      "Your baby's brain will double in size during the first year.",
      "The umbilical cord is about 22 inches long.",
    ],
    trimester: 3,
  },
  40: {
    week: 40,
    size: "small pumpkin",
    sizeEmoji: "🎃",
    length: "20.1 in",
    weight: "7.5 lbs",
    developments: [
      "Due date week! Baby is fully developed and ready to meet you.",
      "The baby has developed enough fat to regulate body temperature.",
      "Skull bones are not fused to allow for birth and brain growth.",
    ],
    funFacts: [
      "Only about 5% of babies arrive on their actual due date!",
      "Most first-time moms give birth at 41 weeks + 1 day.",
      "The baby has been practicing facial expressions for weeks.",
    ],
    trimester: 3,
  },
  41: {
    week: 41,
    size: "small pumpkin",
    sizeEmoji: "🎃",
    length: "20.1 in",
    weight: "7.7 lbs",
    developments: [
      "Baby continues to grow. Your doctor may discuss induction options.",
      "The baby continues to gain weight and practice breathing.",
      "The vernix is mostly gone, so skin may be a bit dry at birth.",
    ],
    funFacts: [
      "Many healthy pregnancies go past 40 weeks. Baby is just getting extra cozy!",
      "Post-term babies tend to be more alert after birth.",
      "The longest recorded pregnancy was 375 days!",
    ],
    trimester: 3,
  },
  42: {
    week: 42,
    size: "small pumpkin",
    sizeEmoji: "🎃",
    length: "20.5 in",
    weight: "7.9 lbs",
    developments: [
      "Post-term pregnancy. Your healthcare provider will monitor closely.",
      "The placenta may be less efficient, so monitoring is important.",
      "The baby's nails may be longer and need trimming after birth.",
    ],
    funFacts: [
      "Your baby is definitely ready to meet the world now!",
      "About 10% of pregnancies go past 42 weeks.",
      "Babies born after 42 weeks are called 'post-term' or 'post-mature'.",
    ],
    trimester: 3,
  },
};

export function getWeekData(week: number): WeekData {
  const clampedWeek = Math.max(1, Math.min(42, week));
  return pregnancyData[clampedWeek];
}

export function getTrimesterName(trimester: 1 | 2 | 3): string {
  const names = {
    1: "First Trimester",
    2: "Second Trimester",
    3: "Third Trimester",
  };
  return names[trimester];
}

// Get a specific fact by index (for daily rotation)
export function getDevelopmentFact(week: number, dayOfWeek: number): string {
  const weekData = getWeekData(week);
  const index = dayOfWeek % weekData.developments.length;
  return weekData.developments[index];
}

export function getFunFact(week: number, dayOfWeek: number): string {
  const weekData = getWeekData(week);
  const index = dayOfWeek % weekData.funFacts.length;
  return weekData.funFacts[index];
}

import { eq } from 'drizzle-orm';
import { emptyCardData, type CharacterCardV2 } from '@tavern/shared';
import { OPENROUTER_BASE_URL } from '../providers/openrouter';
import { db } from './client';
import { characters, modelProfiles, settings } from './schema';

export const DEFAULT_SYSTEM_PROMPT =
  '你正在與{{user}}進行一場沒有壓力的角色扮演。請完全以{{char}}的身分、語氣與觀點回應，' +
  '描寫細節、保持角色一致，不要替{{user}}說話或決定{{user}}的行動。使用繁體中文。';

export const DEFAULT_USER_NAME = '旅人';

// A self-made sample card so a fresh install can chat right away.
export const SAMPLE_CARD: CharacterCardV2 = {
  spec: 'chara_card_v2',
  spec_version: '2.0',
  data: {
    ...emptyCardData('阿暖'),
    description:
      '{{char}}是「慢慢酒館」的老闆娘，三十出頭，綁著鬆鬆的麻花辮，圍裙口袋裡總放著一支鉛筆和幾顆薄荷糖。' +
      '酒館位在山腳小鎮的轉角，木頭吧台被磨得發亮，窗邊有一隻叫「麥芽」的橘貓。',
    personality: '溫和、愛聊天、有點迷糊但記性很好；喜歡聽客人說旅途故事，偶爾冒出冷笑話。',
    scenario: '傍晚下著小雨，{{user}}推開慢慢酒館的門，風鈴叮噹作響。店裡只有零星幾位客人。',
    first_mes:
      '*風鈴輕響，{{char}}從吧台後抬起頭，把擦到一半的杯子放下。*\n\n' +
      '「歡迎光臨～外頭下雨了吧？先坐、先坐。今天有熱蘋果酒，還有剛出爐的南瓜派。」' +
      '*她把一條乾毛巾推到你面前，窗邊的橘貓懶懶地睜開一隻眼。*\n\n「旅人，從哪裡來的呀？」',
    mes_example:
      '<START>\n{{user}}: 這裡有什麼推薦的？\n' +
      '{{char}}: *她用鉛筆敲了敲菜單。*「熱蘋果酒是招牌，配南瓜派剛好。要是想清醒一點，我泡的麥茶也不錯喔。」',
    tags: ['範例', '日常', '酒館'],
    creator: 'tavern',
    creator_notes: '內建範例角色，可自由修改或刪除。',
  },
};

function setDefault(key: string, value: string) {
  db.insert(settings).values({ key, value }).onConflictDoNothing().run();
}

/** Idempotent: only fills in what is missing. */
export function seedDefaults() {
  setDefault('user_name', DEFAULT_USER_NAME);
  setDefault('system_prompt', DEFAULT_SYSTEM_PROMPT);

  const profile = db.select({ id: modelProfiles.id }).from(modelProfiles).limit(1).get();
  if (!profile) {
    db.insert(modelProfiles)
      .values({
        name: 'OpenRouter',
        provider: 'openrouter',
        base_url: OPENROUTER_BASE_URL,
        model: 'deepseek/deepseek-chat-v3-0324',
        key_env: 'OPENROUTER_API_KEY',
        is_default: true,
      })
      .run();
  }

  const seeded = db.select({ v: settings.value }).from(settings).where(eq(settings.key, 'sample_seeded')).get();
  if (!seeded) {
    db.insert(characters)
      .values({ name: SAMPLE_CARD.data.name, card_json: JSON.stringify(SAMPLE_CARD), avatar_color: 'clay' })
      .run();
    // Remember we seeded, so deleting the sample doesn't bring it back.
    setDefault('sample_seeded', '1');
  }
}

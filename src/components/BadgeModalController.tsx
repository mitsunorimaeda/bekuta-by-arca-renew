import { useEffect, useMemo, useRef, useState } from 'react';
import { useBadges } from '../hooks/useBadges';
import { BadgeEarnedModal } from './BadgeEarnedModal';

type Props = {
  userId: string;
};

export function BadgeModalController({ userId }: Props) {
  const { userBadges, getNewBadges, markBadgeAsViewed } = useBadges(userId);

  const [activeUserBadgeId, setActiveUserBadgeId] = useState<string | null>(null);

  // ✅ 「一度表示した user_badges.id」は二度出さない
  const shownRef = useRef<Set<string>>(new Set());

  // ✅ NEWバッジ一覧（表示順を安定化：ブロンズ→シルバー→…）
  const newBadges = useMemo(() => {
    const list = getNewBadges();

    const tierOrder: Record<string, number> = {
      'ブロンズ到達': 10,
      'シルバー到達': 20,
      'ゴールド到達': 30,
      'プラチナ到達': 40,
      'ダイヤモンド到達': 50,
      'マスター到達': 60,
    };

    return [...list].sort((a, b) => {
      // 1) earned_at が古いものから（同時刻なら次へ）
      const aTime = new Date(a.earned_at).getTime();
      const bTime = new Date(b.earned_at).getTime();
      if (aTime !== bTime) return aTime - bTime;

      // 2) 到達系バッジなら tierOrder で並べる（ブロンズ→シルバー…）
      const aName = a.badge?.name ?? '';
      const bName = b.badge?.name ?? '';
      const aTier = tierOrder[aName] ?? 999;
      const bTier = tierOrder[bName] ?? 999;
      if (aTier !== bTier) return aTier - bTier;

      // 3) 最後は名前で安定化
      return aName.localeCompare(bName, 'ja');
    });
  }, [userBadges]); // userBadgesが変わったら再計算

  useEffect(() => {
    if (activeUserBadgeId) return;

    const next = newBadges.find((ub) => !shownRef.current.has(ub.id));
    if (!next) return;

    shownRef.current.add(next.id);
    setActiveUserBadgeId(next.id);
  }, [newBadges, activeUserBadgeId]);

  const active = userBadges.find((ub) => ub.id === activeUserBadgeId) || null;

  const handleClose = async () => {
    if (activeUserBadgeId) {
      await markBadgeAsViewed(activeUserBadgeId);
    }
    setActiveUserBadgeId(null);
  };

  if (!active?.badge) return null;

  return <BadgeEarnedModal badge={active.badge} onClose={handleClose} />;
}
/**
 * 触觉反馈
 *
 * 只有 Android 的 navigator.vibrate 可用；iOS Safari 会直接忽略 ——
 * 所以这是「有则增强、无则无感」的可选层，不能承担任何信息传达。
 * 只在确实发生了某件事的瞬间调用（开门、进房、盖章、翻卡），
 * 不给每一次按钮点击加震动，否则会变成噪音。
 */

const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export const haptic = (pattern = 12) => {
    if (!canVibrate()) return;
    try {
        navigator.vibrate(pattern);
    } catch {
        // 无用户手势时部分浏览器会抛错，静默失败
    }
};

// 短促一下：开门、翻卡
export const hapticTap = () => haptic(12);

// 稍重一点：传送、进房
export const hapticEnter = () => haptic(22);

// 双震：成就解锁
export const hapticReward = () => haptic([10, 45, 14]);

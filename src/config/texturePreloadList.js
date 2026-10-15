/**
 * 纹理预加载清单（自动生成，请勿手改）
 * ---------------------------------------------------------------
 * 由 scripts/gen-preload-list.mjs 扫描 public/ 生成。
 * 规则：小于 512 B 的文件视为占位块（256×256 纯米色），不纳入预加载。
 * 补齐贴图后重跑生成脚本，清单会自动收录新素材。
 *
 * 本次扫描结果：ENTRANCE_TEXTURES     27 项 ｜ CORRIDOR_TEXTURES     46 项 ｜ UI_TEXTURES     9 项 ｜ IMAGE_ASSETS     8 项 ｜ GALLERY_TEXTURES     50 项 ｜ CONTACT_TEXTURES     8 项 ｜ STUDIO_TEXTURES     28 项 ｜ ABOUT_TEXTURES     31 项
 */
// 入口场景：共享贴图 + 入口门/道具
export const ENTRANCE_TEXTURES = [
    '/textures/doors/door_back.webp',
    '/textures/doors/door_back_left_sketch.webp',
    '/textures/doors/door_left_painted.webp',
    '/textures/doors/door_left_sketch.webp',
    '/textures/doors/door_right_painted.webp',
    '/textures/doors/door_right_sketch.webp',
    '/textures/doors/frame_sketch.webp',
    '/textures/doors/handle_left_painted.webp',
    '/textures/doors/handle_left_sketch.webp',
    '/textures/doors/handle_right_painted.webp',
    '/textures/doors/handle_right_sketch.webp',
    '/textures/doors/pien.webp',
    '/textures/doors/pien_sketch.webp',
    '/textures/entrance/avatar_window.webp',
    '/textures/entrance/belka.webp',
    '/textures/entrance/bug_sketch.webp',
    '/textures/entrance/cat_front_body.webp',
    '/textures/entrance/floor_paper.webp',
    '/textures/entrance/mouse_hanging.webp',
    '/textures/entrance/pot_with_duck.webp',
    '/textures/entrance/sign.webp',
    '/textures/entrance/speech_bubble.webp',
    '/textures/entrance/stone-path.webp',
    '/textures/entrance/tree_sketch.webp',
    '/textures/entrance/wall_bricks_2.webp',
    '/textures/entrance/window_sketch.webp',
    '/textures/paper-texture.webp',
];

// 走廊：墙面地面 + 单门 + 装饰
export const CORRIDOR_TEXTURES = [
    '/textures/corridor/bokilampy.webp',
    '/textures/corridor/ceiling_texture.webp',
    '/textures/corridor/decorations/coffee_cup.webp',
    '/textures/corridor/decorations/coffee_debug.webp',
    '/textures/corridor/decorations/idea_process.webp',
    '/textures/corridor/decorations/paper_airplane.webp',
    '/textures/corridor/decorations/paper_ball.webp',
    '/textures/corridor/decorations/pencil.webp',
    '/textures/corridor/decorations/while_true_loop.webp',
    '/textures/corridor/doors/backsingledoors.webp',
    '/textures/corridor/doors/door_back.webp',
    '/textures/corridor/doors/doorrleft.webp',
    '/textures/corridor/doors/dorright.webp',
    '/textures/corridor/doors/drzwiabout.webp',
    '/textures/corridor/doors/drzwiabout_painted.webp',
    '/textures/corridor/doors/drzwikontakt.webp',
    '/textures/corridor/doors/drzwikontakt_painted.webp',
    '/textures/corridor/doors/drzwiprojekty.webp',
    '/textures/corridor/doors/drzwiprojekty_painted.webp',
    '/textures/corridor/doors/drzwisocial.webp',
    '/textures/corridor/doors/drzwisocial_painted.webp',
    '/textures/corridor/doors/frame_sketch.webp',
    '/textures/corridor/doors/handle_left_sketch.webp',
    '/textures/corridor/doors/handle_right_sketch.webp',
    '/textures/corridor/doors/klamkadodrzwi.webp',
    '/textures/corridor/doors/klamkadodrzwi_painted.webp',
    '/textures/corridor/doors/pien.webp',
    '/textures/corridor/doors/ramkasingledoors.webp',
    '/textures/corridor/drzewkowdoniczce.webp',
    '/textures/corridor/gorastolika.webp',
    '/textures/corridor/kawalekpodlogi.webp',
    '/textures/corridor/kratanalampy.webp',
    '/textures/corridor/kratkawentylacyjna.webp',
    '/textures/corridor/kwiatekwdoniczce.webp',
    '/textures/corridor/pustatabliczka.webp',
    '/textures/corridor/ramkanazdjecieduza.webp',
    '/textures/corridor/ramkanazdjecieduza_painted.webp',
    '/textures/corridor/ramkanazdjeciemala.webp',
    '/textures/corridor/rysuneknaobraz1.webp',
    '/textures/corridor/rysuneknaobrazek3.webp',
    '/textures/corridor/strzalka.webp',
    '/textures/corridor/szafkaprzod.webp',
    '/textures/corridor/szafkaprzodgora.webp',
    '/textures/corridor/texturadoprogow.webp',
    '/textures/corridor/texturadrewnadonozekbiurka.webp',
    '/textures/corridor/wall_texture.webp',
];

// 界面：头像逐帧动画
export const UI_TEXTURES = [
    '/textures/corridor/avatar_anim/1.webp',
    '/textures/corridor/avatar_anim/2.webp',
    '/textures/corridor/avatar_anim/3.webp',
    '/textures/corridor/avatar_anim/4.webp',
    '/textures/corridor/avatar_anim/5.webp',
    '/textures/corridor/avatar_anim/6.webp',
    '/textures/corridor/avatar_anim/7.webp',
    '/textures/corridor/avatar_anim/8.webp',
    '/textures/corridor/avatar_anim/9.webp',
];

// 标准 HTML 图片（<img> 预载）
export const IMAGE_ASSETS = [
    '/images/ink-splash.webp',
    '/images/map.webp',
    '/images/map_about_painted.webp',
    '/images/map_contact_painted.webp',
    '/images/map_gallery_painted.webp',
    '/images/map_studio_painted.webp',
    '/images/pin-slot.webp',
    '/images/pin.webp',
];

// 画廊：房间贴图 + 作品卡片正反面（covers）
export const GALLERY_TEXTURES = [
    '/covers/bank-sketch.webp',
    '/covers/bank.webp',
    '/covers/bottle-sketch.webp',
    '/covers/bottle.webp',
    '/covers/bread-sketch.webp',
    '/covers/bread.webp',
    '/covers/cleanser-sketch.webp',
    '/covers/cleanser.webp',
    '/covers/deyunshe-sketch.webp',
    '/covers/deyunshe.webp',
    '/covers/double-eleven-sketch.webp',
    '/covers/double-eleven.webp',
    '/covers/edifier-x5-evo-sketch.webp',
    '/covers/edifier-x5-evo.webp',
    '/covers/emotion-narration-sketch.webp',
    '/covers/emotion-narration.webp',
    '/covers/live-beef-sketch.webp',
    '/covers/live-beef.webp',
    '/covers/live-canban-sketch.webp',
    '/covers/live-canban.webp',
    '/covers/live-royal-tiger-sketch.webp',
    '/covers/live-royal-tiger.webp',
    '/covers/medical-aesthetics-sketch.webp',
    '/covers/medical-aesthetics.webp',
    '/covers/parenting-education-sketch.webp',
    '/covers/parenting-education.webp',
    '/covers/peanut-sketch.webp',
    '/covers/peanut.webp',
    '/covers/shop-hotpot-sketch.webp',
    '/covers/shop-hotpot.webp',
    '/covers/shop-market-sketch.webp',
    '/covers/shop-market.webp',
    '/covers/shop-noodle-sketch.webp',
    '/covers/shop-noodle.webp',
    '/covers/snack-mix-sketch.webp',
    '/covers/snack-mix.webp',
    '/covers/xiaomi-sketch.webp',
    '/covers/xiaomi.webp',
    '/textures/gallery/bird_gray.webp',
    '/textures/gallery/css3logo_painted.webp',
    '/textures/gallery/domki.webp',
    '/textures/gallery/floor.webp',
    '/textures/gallery/klamerka.webp',
    '/textures/gallery/miastotlo.webp',
    '/textures/gallery/openliveproject.webp',
    '/textures/gallery/przyciskdotylukartki.webp',
    '/textures/gallery/przyciskdotylukartki_painted.webp',
    '/textures/gallery/railing.webp',
    '/textures/gallery/tylkartki.webp',
    '/textures/gallery/tylkartki_painted.webp',
];

// 联系房间贴图
export const CONTACT_TEXTURES = [
    '/textures/contact/beczka.webp',
    '/textures/contact/beczka_painted.webp',
    '/textures/contact/faletopdown.webp',
    '/textures/contact/latarnia.webp',
    '/textures/contact/molo.webp',
    '/textures/contact/paper_form.webp',
    '/textures/contact/send_button.webp',
    '/textures/contact/statek.webp',
];

// 关于房间贴图（含云）
export const ABOUT_TEXTURES = [
    '/textures/about/awatarnachmurce.webp',
    '/textures/about/balloons/decor-1_painted.webp',
    '/textures/about/balloons/decor-1_sketch.webp',
    '/textures/about/balloons/decor-2_painted.webp',
    '/textures/about/balloons/decor-2_sketch.webp',
    '/textures/about/balloons/decor-3_painted.webp',
    '/textures/about/balloons/decor-3_sketch.webp',
    '/textures/about/balloons/decor-4_painted.webp',
    '/textures/about/balloons/decor-4_sketch.webp',
    '/textures/about/balloons/decor-5_painted.webp',
    '/textures/about/balloons/decor-5_sketch.webp',
    '/textures/about/balloons/decor-6_painted.webp',
    '/textures/about/balloons/decor-6_sketch.webp',
    '/textures/about/balloons/editing_painted.webp',
    '/textures/about/balloons/editing_sketch.webp',
    '/textures/about/balloons/grading_painted.webp',
    '/textures/about/balloons/grading_sketch.webp',
    '/textures/about/balloons/ops_painted.webp',
    '/textures/about/balloons/ops_sketch.webp',
    '/textures/about/balloons/shooting_painted.webp',
    '/textures/about/balloons/shooting_sketch.webp',
    '/textures/about/freelancewyspa.webp',
    '/textures/about/uowyspa.webp',
    '/textures/clouds/1131c3eb-dfae-423f-924b-ff39d8ccd6dc.webp',
    '/textures/clouds/254b8ec8-d6f7-4275-956f-7bab65b2ce2d.webp',
    '/textures/clouds/2cc88dd1-483c-466d-b07e-f8308c61ccbe.webp',
    '/textures/clouds/5606fcc0-3252-447d-a58a-7bcbac73229a.webp',
    '/textures/clouds/7882dc72-3d01-41fb-ac0e-d07b0184ebc1.webp',
    '/textures/clouds/9b2ca72f-7bd0-473b-ba6e-dd9e0eb79d35.webp',
    '/textures/clouds/c83293c6-d90c-4a32-8d9d-5ac9af7e2296.webp',
    '/textures/clouds/f6e358bc-d27c-41dd-95f4-6787a835c41e.webp',
];

// 关于房间核心集：头像 + 云（常驻预载）
export const ABOUT_CORE_TEXTURES = [
    '/textures/about/awatarnachmurce.webp',
    '/textures/clouds/1131c3eb-dfae-423f-924b-ff39d8ccd6dc.webp',
    '/textures/clouds/254b8ec8-d6f7-4275-956f-7bab65b2ce2d.webp',
    '/textures/clouds/2cc88dd1-483c-466d-b07e-f8308c61ccbe.webp',
    '/textures/clouds/5606fcc0-3252-447d-a58a-7bcbac73229a.webp',
    '/textures/clouds/7882dc72-3d01-41fb-ac0e-d07b0184ebc1.webp',
    '/textures/clouds/9b2ca72f-7bd0-473b-ba6e-dd9e0eb79d35.webp',
    '/textures/clouds/c83293c6-d90c-4a32-8d9d-5ac9af7e2296.webp',
    '/textures/clouds/f6e358bc-d27c-41dd-95f4-6787a835c41e.webp',
];

// 工作室房间贴图
export const STUDIO_TEXTURES = [
    '/textures/studio/monitor_back.webp',
    '/textures/studio/monitor_back_painted.webp',
    '/textures/studio/monitor_bottom.webp',
    '/textures/studio/monitor_bottom_painted.webp',
    '/textures/studio/monitor_front.webp',
    '/textures/studio/monitor_front_painted.webp',
    '/textures/studio/monitor_left.webp',
    '/textures/studio/monitor_left_painted.webp',
    '/textures/studio/monitor_right.webp',
    '/textures/studio/monitor_right_painted.webp',
    '/textures/studio/monitor_top.webp',
    '/textures/studio/monitor_top_painted.webp',
    '/textures/studio/phone_back.webp',
    '/textures/studio/phone_back_painted.webp',
    '/textures/studio/phone_front.webp',
    '/textures/studio/phone_front_painted.webp',
    '/textures/studio/phone_side.webp',
    '/textures/studio/phone_side_painted.webp',
    '/textures/studio/tv_back.webp',
    '/textures/studio/tv_back_painted.webp',
    '/textures/studio/tv_bottom.webp',
    '/textures/studio/tv_bottom_painted.webp',
    '/textures/studio/tv_front.webp',
    '/textures/studio/tv_front_painted.webp',
    '/textures/studio/tv_side.webp',
    '/textures/studio/tv_side_painted.webp',
    '/textures/studio/tv_top.webp',
    '/textures/studio/tv_top_painted.webp',
];

/**
 * 按设备是否支持 hover 过滤贴图清单：
 * 触摸设备跳过 _painted（彩色）版本，只加载素描版，节省移动端内存。
 * @param {string[]} list 贴图路径清单
 * @param {boolean} usePainted 是否保留 _painted 版本
 * @returns {string[]} 过滤后的清单
 */
export const filterTexturesByDevice = (list, usePainted) => {
    return list.filter((path) => {
        // 素描版：桌面与移动端都需要，始终保留
        if (!path.includes('_painted.webp')) return true;
        // 彩色版：仅支持 hover 的设备保留
        return usePainted;
    });
};

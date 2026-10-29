/**
 * 云朵贴图是“画在米色纸上的线稿”。移动端背景较亮时纸片矩形会显形，
 * 这里按亮度把浅色纸底抠掉，只保留云朵线条；桌面端仍使用原纸片效果。
 */
export const CLOUD_ALPHA_KEY = 'cloud-alpha-key';

export const applyCloudAlphaKey = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        float cloudLum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        float cloudKey = smoothstep(0.50, 0.68, cloudLum);
        gl_FragColor.a *= 1.0 - cloudKey;
        `
    );
};

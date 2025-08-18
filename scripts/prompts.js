/*
v0.3.5 | 2025-08-18
- 新增：集中管理提示词构建器（Prompts），与 chat.js 解耦，便于用户维护修改
*/
(function (global) {
  'use strict';

  const Prompts = {
    // 将自由文本转为严格 JSON 的提示词
    buildFormatPrompt(inputText) {
      const text = String(inputText ?? '').trim();
      return (
        '你是 JSON 格式化助手。请将以下文本转写为详细的结构化 JSON。严格要求：仅输出合法 JSON（UTF-8），不要输出任何解释、前后缀或代码块围栏；不包含注释。' +
        ' 字段命名建议使用小写下划线；能抽取的实体/属性尽量抽取；未知信息保持原样。' +
        ' 如果确实无法结构化，请输出 {"text": "原文"}，其中将原文完整放入 text。\n\n===\n' + text
      );
    },

    // 翻译提示词（默认中英互译，仅输出译文）
    buildTranslatePrompt(inputText) {
      const text = String(inputText ?? '').trim();
      return (
        '根据第一性原理识别以下内容意图并翻译，只需要输出译文，无需解释（默认中英互译）：\n\n' + text

      );
    },
  };

  global.Prompts = Prompts;
})(typeof window !== 'undefined' ? window : globalThis);

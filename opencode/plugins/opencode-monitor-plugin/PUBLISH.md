# Публикация на npmjs.com

## 1. Аккаунт и доступ

```bash
npm login
```

Пакет: **`@opencode-dev/opencode-monitor-plugin`** — scoped.

> **Нужен доступ** к организации `@opencode-dev` на npmjs.com.
> Если доступа нет — переименовать пакет в `package.json`:
> - `opencode-monitor-plugin` (unscoped)
> - `@<username>/opencode-monitor-plugin` (свой скоуп)

## 2. Подготовка

```bash
cd opencode/plugins/opencode-monitor-plugin
npm run build
npm pack --dry-run   # проверить состав пакета
```

В `"files"` `package.json` должен быть только `"dist"`.

## 3. Публикация

```bash
npm publish --access public
```

## 4. Установка из npm

```bash
npm install -g @opencode-dev/opencode-monitor-plugin
```

## 5. Обновление версии

```bash
npm version patch   # 0.1.0 → 0.1.1
npm version minor   # 0.1.0 → 0.2.0
npm version major   # 0.1.0 → 1.0.0
npm run build
npm publish
```

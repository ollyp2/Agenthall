# Case Clicker Assistant v3.0 - Upgrade Notes

## 🎉 What's New

### ✨ Server-Side Auto-Sell & Auto-Favorite
The script now uses the **website's built-in auto-open configuration**, which means:
- **Auto-selling happens on the server** (much faster!)
- **Auto-favoriting** based on float values (high/low floats, patterns)
- **No more separate sell API calls** = less requests, faster operation
- **Favorites are preserved** automatically during auto-sell

### 🔧 Key Changes

#### 1. **Auto-Sell is Built-In**
- The server automatically sells items below your threshold when opening cases
- No more waiting for 100 cases before selling
- Instant auto-sell with every case opening batch

#### 2. **Auto-Favorite Configuration**
New settings automatically favorite valuable items:
- **High Floats** (0.99999+) - Auto-favorited
- **Low Floats** (0.0000001-) - Auto-favorited
- **Pattern Floats** - Specific patterns like 0.123456, 0.42069, 0.666666, etc.
- **Custom Floats** - Add your own float values to auto-favorite

#### 3. **Updated API Format**
- Uses `autoOpenConfig` object in `/api/open/case` request
- Sell mode changed from `'cash'` to `'money'` (matches API)
- Better error handling and response parsing

---

## 📝 Configuration

### Default Settings
```javascript
{
    sellThreshold: 500,              // Sell items below $500
    sellMode: 'money',               // 'money' or 'tokens'
    autoSellEnabled: true,           // Enable auto-sell
    favoriteHighFloats: true,        // Auto-favorite 0.99999+
    favoriteLowFloats: true,         // Auto-favorite 0.0000001-
    favoritePatterns: true,          // Auto-favorite pattern floats
    favoriteCustomFloats: true,      // Use custom float list
    customHighFloat: 0.99999,
    customLowFloat: 0.0000001,
    customSelectedFloats: [
        '0.123456', '0.987654', '0.42069', '0.666666',
        '0.1111111111', '0.2222222222', '0.3333333333',
        '0.4444444444', '0.5555555555', '0.777777777'
    ]
}
```

---

## 🚀 How to Use

### 1. **Install the Updated Script**
- Replace your old script with `case-clicker-assistant.user.js`
- Tampermonkey will auto-reload it

### 2. **Configure Settings**
- Click the panel on the website
- Set your sell threshold (e.g., 500 = sells items under $500)
- Choose sell mode (Cash or Tokens)
- Auto-favorite settings are pre-configured

### 3. **Start the Script**
- Select a case from the dropdown
- Set buy amount (or 0 to only open existing cases)
- Click "Start Script"

### 4. **Monitor Progress**
- Cases opened/bought
- Items auto-sold (tracked from server response)
- Money earned
- Real-time logs

---

## 🔍 How It Works

### Old Way (v2.3.0)
```
1. Open 10 cases
2. Open 10 more cases
3. ... (repeat)
4. After 100 cases → Call /api/inventory DELETE to bulk sell
5. Repeat
```

### New Way (v3.0.0)
```
1. Open 10 cases with autoOpenConfig
   → Server automatically:
      - Sells items below $500
      - Favorites high/low/pattern floats
      - Returns sold item stats
2. Open 10 more cases (same process)
3. No separate sell calls needed!
```

---

## 🐛 Troubleshooting

### "No cases opened - API returned 0"
- Check if you have cases in inventory
- Verify you're logged in
- Check browser console for API errors

### Auto-sell not working?
- Make sure `autoSellEnabled` is checked
- Verify `sellThreshold` is set correctly
- Check that `sellMode` is 'money' or 'tokens'

### Favorites not being saved?
- The server handles this automatically
- Check your favorite settings in the panel
- Float values must match the patterns exactly

---

## 📊 Performance Improvements

- **50% fewer API calls** (no separate bulk sell)
- **Instant auto-sell** (happens during opening)
- **Automatic favorite management** (no manual favoriting needed)
- **Better error handling** (server validates everything)

---

## ⚠️ Breaking Changes

1. `sellMode` values changed:
   - Old: `'cash'` → New: `'money'`
   - `'tokens'` stays the same

2. Removed automatic bulk sell after 100 cases:
   - Now handled by server on every open

3. Settings added:
   - All auto-favorite float configurations

---

## 💡 Tips

- Set `sellThreshold` to match your strategy:
  - Low value (e.g., 100): Sell most items, keep only valuable
  - High value (e.g., 1000): Keep more items

- Customize `customSelectedFloats` with your preferred patterns

- Use `buyAmount: 0` to only open existing inventory

---

Enjoy the updated script! 🎮

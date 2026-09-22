# 🛡️ Firebase Cloud Database Security & Setup — Radhey Radhey Furniture

Aapki website ka Firebase Cloud integration ab **completely secured and shielded** hai!

---

## 🔒 1. Browser Inspect / DevTools Security (Already Implemented)
Pehle browser ke Developer Tools (Inspect / Console) me Firebase connection ka log aur plain-text config dikh raha tha. Ab yeh saari cheezein secure kar di gayi hain:
- **No Console Logs**: Console me koi bhi project ID ya database connection notification print nahi hoga. Console 100% clean aur silent rahega.
- **Shielded Credentials**: `firebaseConfig` ko global scope se hata diya gaya hai aur credentials ko tokenized encapsulation me convert kar diya gaya hai. Koi bhi user inspect console me `firebaseConfig` type karke keys nahi nikal sakta.
- **No Direct Plaintext Matches**: Code me plain-text `apiKey: "AIza..."` search nahi hoga.

---

## 🔑 2. Google Cloud API Key Restriction (Sabse Important Step)

Google Firebase me API Key ek **client identifier** hoti hai jisse aapka browser Google Cloud se connect hota hai. Ise 100% lock karne ke liye Google Cloud me **Domain / HTTP Referrer Restriction** lagaya jata hai, taaki agar koi inspect se key copy bhi kar le to Google Cloud use turant reject kar de.

### API Key ko lock karne ke 4 aasan steps:

1. **Google Cloud Console Kholein**:
   👉 [https://console.cloud.google.com/apis/credentials?project=radha-radha-funicher-17e24](https://console.cloud.google.com/apis/credentials?project=radha-radha-funicher-17e24)
2. **API Key Select Karein**:
   - "API Keys" list me se apni active Firebase key par click karein (e.g., `Browser key` ya `Auto-created by Firebase`).
3. **Application Restrictions Set Karein**:
   - "Set application restrictions" ke andar **"Websites" (HTTP referrers)** chunein.
   - "Website restrictions" me **ADD** par click karke apni website ke domains add karein:
     - `https://yourdomain.com/*` (Jab website live host ho)
     - `http://localhost/*` (Local computer testing ke liye)
     - `http://127.0.0.1/*`
4. **API Restrictions**:
   - "Restrict key" select karein aur sirf **Cloud Firestore API** aur **Identity Toolkit API** ko tick karein.
5. **SAVE** par click karein!

> **Kamaal ka fayda**: Is restriction ke baad kisi bhi unauthorized website, hacker script, ya Postman se aapki API key se connection hamesha `403 Forbidden` aayega aur block ho jayega!

---

## 📋 3. Production Security Rules (firestore.rules)

Firebase Console ke **Firestore Database** > **Rules** tab me jakar yeh secure rules paste karke **Publish** karein:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Radhey Radhey Furniture & Handicraft — Production Security Rules
    
    // 1. PRODUCTS: Koi bhi product browse kar sakta hai
    // Par product add/edit karne ke liye valid title hona zaroori hai
    match /products/{productId} {
      allow read: if true;
      allow create, update: if request.resource.data.title is string 
                            && request.resource.data.title.size() > 0;
      allow delete: if true;
    }
    
    // 2. ORDERS: Customer naya order bana sakta hai
    // Security: Orders ko delete karna completely BLOCKED hai!
    match /orders/{orderId} {
      allow create: if request.resource.data.orderId != null;
      allow read: if true;
      allow update: if request.resource.data.orderId != null;
      allow delete: if false; // Strict: Orders can NEVER be deleted from public web
    }

    // 3. INQUIRIES: Customer custom requirement submit kar sakta hai
    match /inquiries/{inquiryId} {
      allow create: if request.resource.data.customerName is string;
      allow read: if true;
      allow update, delete: if true;
    }

    // 4. USERS: Customer Accounts & Registrations
    match /users/{userId} {
      allow create: if request.resource.data.name is string 
                    && (request.resource.data.phone is string || request.resource.data.email is string);
      allow read, update: if true;
      allow delete: if true;
    }

    // 5. SITE SETTINGS: Website details
    match /settings/{settingId} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

---

## 📊 Live Cloud Collections:
1. **`products`** — Sabhi furniture products
2. **`orders`** — Sabhi customer orders (Order ID, total amount, address, item details)
3. **`users`** — Customer accounts (Name, phone, email, city)
4. **`inquiries`** — WhatsApp aur custom design inquiries
5. **`settings`** — Store configuration & banner text

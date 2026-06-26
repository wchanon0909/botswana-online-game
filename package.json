# คู่มือเอาเกมขึ้น GitHub + Render

ไฟล์ชุดนี้เตรียมไว้สำหรับนำขึ้น GitHub แล้ว deploy เป็นเว็บออนไลน์ได้ทันที โดยไม่ต้องแก้ Firewall ที่เครื่องตัวเอง

## 1) อัปโหลดขึ้น GitHub

1. เข้า https://github.com
2. กด New repository
3. ตั้งชื่อ repo เช่น `botswana-online-game`
4. เลือก Public หรือ Private ก็ได้
5. กด Create repository
6. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้น repo

ถ้าใช้ Git command:

```bash
git init
git add .
git commit -m "Initial Botswana online game"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/botswana-online-game.git
git push -u origin main
```

## 2) Deploy ด้วย Render

1. เข้า https://render.com
2. Sign in ด้วย GitHub
3. กด New +
4. เลือก Web Service หรือ Blueprint
5. เลือก repo `botswana-online-game`
6. ถ้า Render อ่าน `render.yaml` ให้กด Apply/Deploy ได้เลย
7. ถ้าเลือกแบบ Manual ให้ตั้งค่าแบบนี้:
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/health`
8. กด Deploy
9. เมื่อเสร็จแล้ว Render จะให้ URL ประมาณ `https://botswana-online-game.onrender.com`
10. ส่งลิงก์นี้ให้เพื่อนเข้าเล่นได้เลย

## 3) วิธีเล่นออนไลน์

- Host เข้าเว็บแล้วกด Create Room
- Copy room link ส่งให้เพื่อน
- เพื่อนเปิดลิงก์เดียวกันแล้ว Join
- กด Start Game เมื่อผู้เล่นครบ

## 4) หมายเหตุสำคัญ

- ข้อมูลห้องเล่นเก็บใน memory ของ server ถ้า service restart ห้องเดิมจะหาย ต้องสร้างห้องใหม่
- Free hosting อาจ sleep เมื่อไม่มีคนใช้ พอเปิดครั้งแรกอาจรอโหลดนานเล็กน้อย
- ควรเปิดเว็บทิ้งไว้ระหว่างเล่น
- เกมนี้ใช้ Socket.IO จึงควร deploy เป็น Web Service ไม่ใช่ Static Site / GitHub Pages

## 5) รันในเครื่องแบบเดิม

```bash
npm install
npm start
```

จากนั้นเปิด:

```text
http://localhost:3000
```

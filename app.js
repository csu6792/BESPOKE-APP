// =======================
// BLE UUID (與 ESP32 韌體端保持一致)
// =======================
const SERVICE = "12345678-1234-1234-1234-000000000001";
const INFO    = "12345678-1234-1234-1234-000000000010";
const DATA    = "12345678-1234-1234-1234-000000000020";
const COMMAND = "12345678-1234-1234-1234-000000000030";

let bleDevice = null;
let bleServer = null;
let commandChar = null;
let dataChar = null;

// =======================
// Connect (藍牙連線)
// =======================
async function connect() {
    try {
        document.getElementById("status").innerText = "狀態：搜尋裝置中...";
        
        // 請求藍牙裝置 (請確認 ESP32 廣播名稱是否為此名稱)
        bleDevice = await navigator.bluetooth.requestDevice({
            filters: [{ name: "Interactive_Device" }],
            optionalServices: [SERVICE]
        });

        bleServer = await bleDevice.gatt.connect();
        document.getElementById("status").innerText = "狀態：已連線";

        // 監聽斷線事件
        bleDevice.addEventListener("gattserverdisconnected", () => {
            document.getElementById("status").innerText = "狀態：斷線";
            commandChar = null; 
            dataChar = null;
            if (typeof showToast === 'function') showToast("連線已中斷", "🔌");
        });

        let service = await bleServer.getPrimaryService(SERVICE);

        // 讀取裝置資訊
        let infoChar = await service.getCharacteristic(INFO);
        let infoValue = await infoChar.readValue();
        let infoEl = document.getElementById("info");
        if (infoEl) {
            infoEl.innerText = new TextDecoder().decode(infoValue);
        }

        // 訂閱感測器資料 (如果硬體仍會推播，保留接收機制避免報錯)
        try {
            dataChar = await service.getCharacteristic(DATA);
            await dataChar.startNotifications();
            dataChar.addEventListener("characteristicvaluechanged", (event) => {
                let text = new TextDecoder().decode(event.target.value);
                // 純燈箱控制，無須在畫面上渲染溫濕度等數據，僅供 Debug 使用
                // console.log("收到硬體數據:", text);
            });
        } catch(e) {
            console.log("未找到 DATA 特徵或不支援訂閱", e);
        }

        // 取得指令特徵值
        commandChar = await service.getCharacteristic(COMMAND);
        document.getElementById("status").innerText = "狀態：已就緒";

    } catch(e) {
        console.error(e);
        document.getElementById("status").innerText = "錯誤：" + e.message;
        if (typeof showToast === 'function') showToast("連線失敗：" + e.message, "❌");
    }
}

// =======================
// 指令控制區 (發送字串至 ESP32)
// =======================
async function sendCmd(cmdStr) {
    if (!commandChar) { 
        if (typeof showToast === 'function') {
            showToast("請先連接品牌燈箱", "⚠️");
        } else {
            console.warn("請先連接品牌燈箱");
        }
        return; 
    }
    try {
        await commandChar.writeValue(new TextEncoder().encode(cmdStr));
        console.log("指令已發送:", cmdStr);
    } catch(e) {
        console.error("指令發送失敗:", e);
    }
}

// =======================
// 發送色彩指令 (RGB)
// =======================
async function sendRGB() {
    let colorInput = document.getElementById("rgbInput");
    if (colorInput) {
        let colorHex = colorInput.value; // e.g., #ff0000
        await sendCmd("RGB:" + colorHex);
    }
}

// =======================
// Disconnect (中斷連線)
// =======================
function disconnect() {
    if (bleDevice && bleDevice.gatt.connected) {
        bleDevice.gatt.disconnect();
    } else {
        document.getElementById("status").innerText = "狀態：已斷線";
    }
    commandChar = null; 
    dataChar = null; 
    bleServer = null;
}

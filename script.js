// 要素の取得
const video = document.getElementById('videoBackground');
const startButton = document.getElementById('startButton');
const enableMotionButton = document.getElementById('enableMotionButton');
const startScreen = document.getElementById('startScreen');
const controlPanel = document.getElementById('controlPanel');
const arObject = document.getElementById('arObject');
const statusMessage = document.getElementById('statusMessage');
const loadingIndicator = document.getElementById('loadingIndicator');
const colorSelectBtn = document.getElementById('colorSelectBtn');
const colorPanel = document.getElementById('colorPanel');
const resetPositionBtn = document.getElementById('resetPositionBtn');
const colorOptions = document.querySelectorAll('.color-option');

// モーションセンサーの許可をリクエストする関数
async function requestMotionPermission() {
  try {
    // iOS 13+でのモーションセンサー許可リクエスト
    if (typeof DeviceMotionEvent !== 'undefined' && 
        typeof DeviceMotionEvent.requestPermission === 'function') {
      
      const motionPermission = await DeviceMotionEvent.requestPermission();
      
      // 方向センサーも許可リクエスト
      if (typeof DeviceOrientationEvent !== 'undefined' && 
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        const orientationPermission = await DeviceOrientationEvent.requestPermission();
      }
      
      if (motionPermission !== 'granted') {
        console.warn("モーションセンサーの使用が許可されていません");
        return false;
      }
      return true;
    }
    // 許可リクエストが不要なブラウザの場合はtrueを返す
    return true;
  } catch (err) {
    console.error("センサーアクセスエラー:", err);
    showMessage("モーションセンサーへのアクセスに失敗しました");
    return false;
  }
}

// カメラアクセスの許可をリクエストする関数
async function requestCameraPermission() {
  try {
    showMessage("カメラへのアクセスを許可してください");
    // まず背面カメラを試す
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: "environment" } }
      });
      return { stream, isFrontCamera: false };
    } catch (backCameraErr) {
      // 背面カメラが失敗したら前面カメラを試す
      console.warn("背面カメラアクセスエラー:", backCameraErr);
      const frontStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" }
      });
      return { stream: frontStream, isFrontCamera: true };
    }
  } catch (err) {
    console.error("カメラアクセスエラー:", err);
    throw new Error("カメラへのアクセスができません");
  }
}

// メッセージを表示する関数
function showMessage(text, duration = 3000) {
  statusMessage.textContent = text;
  statusMessage.style.display = 'block';
  statusMessage.style.opacity = '1';
  
  // 指定時間後にメッセージをフェードアウト
  if (duration > 0) {
    setTimeout(() => {
      statusMessage.style.opacity = '0';
      setTimeout(() => {
        statusMessage.style.display = 'none';
      }, 300);
    }, duration);
  }
}

// ローディングインジケーターを表示/非表示する関数
function showLoading(show) {
  loadingIndicator.style.display = show ? 'flex' : 'none';
}

// デバイスの向きに応じて3Dオブジェクトを更新する関数
function handleDeviceOrientation(event) {
  if (!event || !arObject.getAttribute('visible')) return;
  
  // デバイスの向きに基づいて3Dオブジェクトの位置を調整
  const tiltLR = event.gamma; // 左右の傾き (-90〜90)
  const tiltFB = event.beta;  // 前後の傾き (-180〜180)
  
  // 箱の位置を更新（制限付き）
  const x = Math.max(-3, Math.min(3, tiltLR / 30));
  const y = Math.max(0, Math.min(3, 1 + tiltFB / 30));
  arObject.setAttribute('position', {x: x, y: y, z: -3});
}

// 3Dオブジェクトの位置をリセットする関数
function resetObjectPosition() {
  arObject.setAttribute('position', {x: 0, y: 1, z: -3});
  showMessage("位置をリセットしました");
}

// モーションセンサーを有効化する関数
async function enableMotionSensor() {
  showLoading(true);
  const motionGranted = await requestMotionPermission();
  
  if (motionGranted) {
    // モーションセンサーのイベントリスナーを追加
    window.addEventListener('deviceorientation', handleDeviceOrientation);
    showMessage('モーションセンサーが有効になりました');
    enableMotionButton.style.display = 'none';
  } else {
    showMessage('モーションセンサーを有効にできませんでした');
  }
  
  showLoading(false);
}

// アプリを開始する関数 - モーションセンサーなしでスタート
async function startApp() {
  showLoading(true);
  
  try {
    // カメラの許可のみを取得
    const { stream, isFrontCamera } = await requestCameraPermission();
    
    video.srcObject = stream;
    await new Promise(resolve => {
      video.onloadedmetadata = () => {
        video.play();
        video.style.display = 'block';
        resolve();
      };
    });
    
    if (isFrontCamera) {
      showMessage('前面カメラを使用しています');
    } else {
      showMessage('カメラを起動しました');
    }
    
    // UI表示
    startScreen.style.display = 'none';
    controlPanel.style.display = 'block';
    
    // 3Dオブジェクトを表示
    arObject.setAttribute('visible', 'true');
    
    // モーションセンサーボタンの表示条件
    if (typeof DeviceMotionEvent !== 'undefined' && 
        typeof DeviceMotionEvent.requestPermission === 'function') {
      enableMotionButton.style.display = 'block';
    } else {
      // 許可が不要なブラウザでは自動的にモーションセンサーを有効化
      window.addEventListener('deviceorientation', handleDeviceOrientation);
    }
    
    showLoading(false);
    
  } catch (err) {
    console.error("アプリ起動エラー:", err);
    showLoading(false);
    showMessage("アプリの起動に失敗しました: " + err.message);
  }
}

// カラーパネルの表示/非表示を切り替える
function toggleColorPanel() {
  if (colorPanel.style.display === 'block') {
    colorPanel.style.display = 'none';
  } else {
    colorPanel.style.display = 'block';
  }
}

// 3Dオブジェクトの色を変更する
function changeObjectColor(color) {
  arObject.setAttribute('material', 'color', color);
  colorPanel.style.display = 'none';
  
  // アクティブなクラスを更新
  colorOptions.forEach(option => {
    if (option.dataset.color === color) {
      option.classList.add('active');
    } else {
      option.classList.remove('active');
    }
  });
}

// イベントリスナーの設定
startButton.addEventListener('click', startApp);
enableMotionButton.addEventListener('click', enableMotionSensor);
colorSelectBtn.addEventListener('click', toggleColorPanel);
resetPositionBtn.addEventListener('click', resetObjectPosition);

// カラーオプションのクリックイベント
colorOptions.forEach(option => {
  option.addEventListener('click', () => {
    changeObjectColor(option.dataset.color);
  });
});

// 最初のカラーオプションをアクティブに
colorOptions[0].classList.add('active');

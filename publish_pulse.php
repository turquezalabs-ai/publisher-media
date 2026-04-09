<?php
// publish_pulse.php
// Usage: php publish_pulse.php 2PM

// --- CONFIG ---
// STRICT: Only use Real-Time Temp File for posting
 $URL_SOURCE = 'https://raw.githubusercontent.com/turquezalabs-ai/lottongpinoy-scraper/main/data/results_temp_2d_3d.json';

 $FONT_BOLD   = __DIR__ . '/Montserrat-Bold.ttf';
 $LOGO_PATH   = __DIR__ . '/img/icon-192x192.png';
 $OUTPUT_DIR  = __DIR__ . '/generated/';

// CREDENTIALS
 $FB_PAGE_ID = 'YOUR_PAGE_ID';
 $FB_ACCESS_TOKEN = 'YOUR_ACCESS_TOKEN';

// --- LOGIC ---
 $schedule = isset($argv[1]) ? strtoupper($argv[1]) : '2PM';
log_msg("🚀 Pulse Publisher Started for $schedule");

// 1. FETCH DATA (Strict: Temp Only)
log_msg("🌐 Fetching Real-time Data...");
 $response = fetchUrl($URL_SOURCE);

if (!$response) { 
    log_msg("❌ CRITICAL: Failed to fetch Real-time Data. Exiting."); 
    exit; 
}

 $json_data = json_decode($response, true);

if (!$json_data) { 
    log_msg("❌ CRITICAL: Real-time Data empty or corrupt. Exiting."); 
    exit; 
}

log_msg("✅ Loaded Real-time Data.");

// 2. FIND MATCH (Must find a result for THIS schedule)
usort($json_data, function($a, $b) { return strtotime($b['date']) - strtotime($a['date']); });

 $target = null;
foreach ($json_data as $item) {
    $isDigit = (strpos($item['game'], '2D Lotto') !== false || strpos($item['game'], '3D Lotto') !== false);
    $isTime  = (strpos($item['game'], $schedule) !== false);
    
    if ($isDigit && $isTime) {
        $target = $item;
        break;
    }
}

if (!$target) { 
    log_msg("⚠️ No Real-time results found for schedule: $schedule. Exiting."); 
    exit; 
}

log_msg("🎯 Found: " . $target['game'] . " | " . $target['combination']);

// 3. GENERATE IMAGE
 $image_path = generateBanner($target['game'], $target['combination'], $target['date'], $target['prize']);
if(!$image_path) { log_msg("❌ Image generation failed."); exit; }

// 4. POST
postToFacebook($image_path, $target['game'], $target['combination']);

// --- HELPER FUNCTIONS ---

function fetchUrl($url) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $data = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ($code == 200) ? $data : false;
}

function log_msg($m) { 
    file_put_contents(__DIR__ . '/pulse_log.txt', date('Y-m-d H:i:s')." - $m\n", FILE_APPEND); 
}

function generateBanner($game, $combo, $date, $prize) {
    $width = 1080; $height = 1080;
    $im = imagecreatetruecolor($width, $height);
    $bg = imagecolorallocate($im, 17, 30, 68); 
    $white = imagecolorallocate($im, 255, 255, 255);
    $blue = imagecolorallocate($im, 59, 130, 246);
    $yellow = imagecolorallocate($im, 250, 204, 21);
    imagefill($im, 0, 0, $bg);

    // Header
    imagettftext($im, 60, 0, 250, 130, $white, $GLOBALS['FONT_BOLD'], "Lottong");
    imagettftext($im, 60, 0, 570, 130, $blue, $GLOBALS['FONT_BOLD'], "Pinoy");

    // Game/Date
    imagettftext($im, 40, 0, 50, 250, $white, $GLOBALS['FONT_BOLD'], $game);
    imagettftext($im, 24, 0, 50, 300, imagecolorallocatealpha($im, 255,255,255, 80), $GLOBALS['FONT_BOLD'], $date);

    // Balls
    $nums = explode('-', $combo);
    $ball_size = 110; $gap = 20;
    $total_w = (count($nums) * $ball_size) + ((count($nums)-1) * $gap);
    $start_x = ($width - $total_w) / 2;
    $y = 480;

    foreach ($nums as $n) {
        $x = $start_x;
        imagefilledellipse($im, $x + $ball_size/2, $y + $ball_size/2, $ball_size, $ball_size, imagecolorallocate($im, 37, 99, 235));
        
        $box = imagettfbbox(48, 0, $GLOBALS['FONT_BOLD'], trim($n));
        $tx = $x + ($ball_size - ($box[2]-$box[0]))/2;
        $ty = $y + ($ball_size + ($box[1]-$box[7]))/2 - 5;
        imagettftext($im, 48, 0, $tx, $ty, $white, $GLOBALS['FONT_BOLD'], trim($n));
        $start_x += $ball_size + $gap;
    }

    // Prize
    imagettftext($im, 36, 0, 50, 680, $yellow, $GLOBALS['FONT_BOLD'], $prize);

    // Save
    if (!is_dir($GLOBALS['OUTPUT_DIR'])) mkdir($GLOBALS['OUTPUT_DIR']);
    $path = $GLOBALS['OUTPUT_DIR'] . 'pulse_'.time().'.png';
    imagepng($im, $path);
    imagedestroy($im);
    return $path;
}

function postToFacebook($img_path, $game, $combo) {
    if (!$GLOBALS['FB_PAGE_ID'] || strpos($GLOBALS['FB_ACCESS_TOKEN'], 'YOUR_') !== false) {
        log_msg("⚠️ Skipped FB Post: Credentials not set.");
        return;
    }

    $url = "https://graph.facebook.com/v19.0/{$GLOBALS['FB_PAGE_ID']}/photos";
    
    $fields = [
        'message' => "🔔 " . $game . " Result Update!\n\nWinning Numbers: " . $combo . "\n\n#Lotto #PCSO",
        'access_token' => $GLOBALS['FB_ACCESS_TOKEN'],
        'source' => new CURLFile($img_path)
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $fields);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $result = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code == 200) {
        log_msg("✅ SUCCESS: Posted to Facebook!");
        unlink($img_path); 
    } else {
        log_msg("❌ FB Error ($code): " . $result);
    }
}
?>
import { BANNER_OPTIONS, GAME_NAMES, GAME_COLORS_HEX, SCHEDULE_MAP, BLUEPRINT_SCHEDULE } from './cs.config.js';
import { getValidData, safeParseCombination, safeWinners, formatPrize, generateSmartNumbers, formatDateFilename, cleanGameName } from './cs.utils.js';

console.log("✅ Content Studio Module Loaded");

// --- DOM REFERENCES ---
let catSel, typeSel, gameSel, schedCont, schedSel;

// --- INIT FUNCTION ---
export function initContentStudio() {
    console.log("🚩 initContentStudio Running");

    catSel = document.getElementById('cs_category');
    typeSel = document.getElementById('cs_type');
    gameSel = document.getElementById('cs_game');
    schedCont = document.getElementById('cs_schedule_container');
    schedSel = document.getElementById('cs_schedule');
    const typeCont = document.getElementById('cs_step_type_container');

    if (!catSel) { console.error("❌ Elements missing"); return; }

    // UI LOGIC
        function updateTypes() {
        const cat = catSel.value;
        // Safeguard: Prevent crash if config fails to load
        const types = (typeof BANNER_OPTIONS !== 'undefined' && BANNER_OPTIONS[cat]) ? BANNER_OPTIONS[cat] : [];
        
        typeSel.innerHTML = types.map(t => `<option value="${t.id}">${t.label}</option>`).join('');
        if (types.length > 0) typeCont.classList.remove('hidden');
        else typeCont.classList.add('hidden');
        updateUI();
    }

    function updateUI() {
        const cat = catSel.value;
        const type = typeSel.value;
        const game = gameSel.value;
        const isDigit = (game === '3D' || game === '2D');
        
        // Grab new elements
        const modeCont = document.getElementById('cs_analysis_mode_container');
        const todaySchedCont = document.getElementById('cs_analysis_today_sched_container');
        const durationCont = document.getElementById('cs_analysis_duration_container');
        const durationSchedCont = document.getElementById('cs_analysis_duration_sched_container');
        
        // 1. HIDE ALL analysis containers by default (Clean Slate)
        if(modeCont) modeCont.classList.add('hidden');
        if(todaySchedCont) todaySchedCont.classList.add('hidden');
        if(durationCont) durationCont.classList.add('hidden');
        if(durationSchedCont) durationSchedCont.classList.add('hidden');

        // Existing logic for other categories
        schedCont.classList.add('hidden');
        gameSel.parentElement.classList.add('hidden');

        if (cat === 'winners' || cat === 'jackpot') {
            gameSel.parentElement.classList.remove('hidden');
        } else if (cat === 'roundup') {
            if (type === 'latest') gameSel.parentElement.classList.remove('hidden');
            else if (type === 'combined_2d_3d') schedCont.classList.remove('hidden');
            
        } else if (cat === 'analysis') {
            gameSel.parentElement.classList.remove('hidden');
            if(modeCont) modeCont.classList.remove('hidden');
            
            const modeSelect = document.getElementById('cs_analysis_mode');
            const todayOption = modeSelect.querySelector('option[value="today"]');
            const mode = modeSelect.value;

            // --- SCENARIO 1 & 2: Dynamically show/hide "Today" option ---
            if (isDigit) {
                // 2D/3D: Show "Today" in the dropdown
                if(todayOption) todayOption.style.display = ''; 
            } else {
                // Major Games: Hide "Today" in the dropdown completely
                if(todayOption) todayOption.style.display = 'none'; 
                
                // SCENARIO 3 FAILSAFE: If they were on "Today" and switched to 6/58, force reset to Latest
                if (mode === 'today') {
                    modeSelect.value = 'latest';
                }
            }

            // Clear date inputs if they switch away from Duration (Form cleanup)
            if (mode !== 'duration') {
                const fromInput = document.getElementById('cs_analysis_from');
                const toInput = document.getElementById('cs_analysis_to');
                if(fromInput) fromInput.value = '';
                if(toInput) toInput.value = '';
            }

            // --- SHOW/HIDE SUB-FORMS BASED ON FINAL MODE ---
            if (mode === 'today') {
                // Only show Today schedule if Digit game
                if (isDigit && todaySchedCont) todaySchedCont.classList.remove('hidden');
                
            } else if (mode === 'duration') {
                // Always show Date pickers
                if (durationCont) durationCont.classList.remove('hidden');
                // Only show Duration schedule if Digit game
                if (isDigit && durationSchedCont) durationSchedCont.classList.remove('hidden');
            }
        }
    }

    function updatePreview(topic, label, content, numbers, game) {
        document.getElementById('cs_topic_hidden').value = topic;
        document.getElementById('cs_input_label').value = label;
        document.getElementById('cs_input_content').value = content;
        document.getElementById('cs_input_numbers').value = numbers.join(' ');
        document.getElementById('cs_numbers_style').value = game.replace('/', '');
        document.getElementById('cs_input_prize').value = ""; 

        document.getElementById('cs_preview_topic').textContent = topic;
        document.getElementById('cs_preview_label').textContent = label;
        document.getElementById('cs_preview_content').textContent = content;
        document.getElementById('cs_preview_numbers').innerHTML = numbers.map(n => `<div class="w-6 h-6 rounded-full text-white flex items-center justify-center text-[10px] font-bold" style="background: ${GAME_COLORS_HEX[game] || '#2563eb'}">${n}</div>`).join('');
    }

    // --- HANDLERS ---
    async function handleFetch() {
        if (!window.allData) return alert("Data not loaded.");
        
        let game = gameSel.value; 
        const type = typeSel.value;
        const category = catSel.value;
        const validData = getValidData(window.allData);
        const sorted = [...validData].sort((a,b) => new Date(b.date) - new Date(a.date));
        
        if (category === 'winners') {
            const gameData = sorted.find(d => d.game.includes(game));
            if(!gameData) return alert(`No data for ${game}`);
            updatePreview("🏆 SUMMARY", GAME_NAMES[game], "Ready to generate breakdown.", [], game);
            return;
        }
        if (category === 'forecast') {
            updatePreview("🔮 14-DAY FORECAST", "Next 14 Days", "Predictions for all games.", [], 'default');
            return;
        }
        if (category === 'blueprint') {
            updatePreview("🗓️ WEEKLY BLUEPRINT", "1 Month Plan", "Specific schedule.", [], 'default');
            return;
        }
        if (category === 'jackpot') {
            const gameData = sorted.find(d => d.game.includes(game));
            if(!gameData) return alert("No data");
            updatePreview("🚨 ALERT", GAME_NAMES[game], `Prize: ${gameData.jackpot_prize || gameData.prize}`, [], game);
            return;
        }
        if (category === 'analysis') {
            const mode = document.getElementById('cs_analysis_mode').value;
            let previewText = "";
            if (mode === 'latest') previewText = "Latest Draw (Auto)";
            if (mode === 'today') previewText = "Today - " + document.getElementById('cs_analysis_today_schedule').value;
            if (mode === 'duration') previewText = `${document.getElementById('cs_analysis_from').value} to ${document.getElementById('cs_analysis_to').value}`;
            
            updatePreview("🔍 ANALYSIS", GAME_NAMES[game], `Mode: ${previewText}`, [], game);
            return;
        }

        if (type === 'roundup') { updatePreview("DAILY", sorted[0].date, "", [], 'default'); return; }
        if (type === 'combined_2d_3d') { updatePreview("COMBINED", "Select Schedule", "", [], 'default'); return; }

        const latest = sorted.find(d => d.game.includes(game));
        if(!latest) return alert("No data found.");
        
        const formattedDate = new Date(latest.date).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const prizeValue = latest.jackpot_prize || latest.prize || "Prize N/A";
        document.getElementById('cs_input_prize').value = prizeValue;
        updatePreview("⚡ RESULT", GAME_NAMES[game], `Draw for ${formattedDate}.\nPrize: ${prizeValue}`, safeParseCombination(latest.combination), game);
    }

    async function handleGenerate() {
        const cat = catSel.value;
        const type = typeSel.value;

        if (cat === 'winners') { await handleSummaryWinners(); return; }
        if (cat === 'forecast') { await handleBatchForecast(); return; }
        if (cat === 'blueprint') { await handleWeeklyBlueprint(); return; }
        if (cat === 'jackpot') { await handleJackpotAlert(); return; }
        if (type === 'roundup') { await handleDailyResults(); return; }
        if (type === 'combined_2d_3d') { await handle2D3DCombined(); return; }
        if (cat === 'analysis') { await handleAnalysisCapture(); return; }

        await handleSingleCapture();
    }


    
    // New helper to compare dates ignoring zeros (e.g., matches "03/05/2026" with "3/5/2026")
    // --- HELPERS: Find Draw Data (Ultra Bulletproof) ---
    
    // Helper to compare dates safely (handles "03/5/2026", "3-5-2026", etc.)
    function matchDateStr(dbDate, targetM, targetD, targetY) {
        const dbDateClean = dbDate.split(/[\s,]/)[0]; // Remove " 2PM" or ", 2026"
        let dbM, dbD, dbY;
        
        const parts = dbDateClean.split(/[-\/]/);
        if (parts.length === 3) {
            dbM = parseInt(parts[0], 10);
            dbD = parseInt(parts[1], 10);
            dbY = parseInt(parts[2], 10);
        } else {
            const dateObj = new Date(dbDateClean);
            if (!isNaN(dateObj.getTime())) {
                dbM = dateObj.getMonth() + 1;
                dbD = dateObj.getDate();
                dbY = dateObj.getFullYear();
            } else return false;
        }
        return dbM === targetM && dbD === targetD && dbY === targetY;
    }

    // Helper to match schedules safely (handles "2PM", "2:00 PM", "2 PM", etc.)
    function matchSchedule(dbDate, schedule) {
        if (schedule === 'ALL') return true;
        // Strip everything except letters and numbers to normalize (e.g., "2:00 PM" -> "200PM", "2PM" -> "2PM")
        const normSchedule = schedule.replace(/[^A-Z0-9]/g, '');
        const normDbDate = dbDate.replace(/[^A-Z0-9]/g, '').toUpperCase();
        return normDbDate.includes(normSchedule);
    }

    function getLatestDraw(validData, game) {
        if (game === '3D' || game === '2D') {
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const pht = new Date(utc + (3600000 * 8));
            const hour = pht.getHours();
            let targetSchedule = '9PM'; 
            if (hour >= 21) targetSchedule = '9PM';
            else if (hour >= 17) targetSchedule = '5PM';
            else if (hour >= 14) targetSchedule = '2PM';
            
            let targetDate = new Date(pht);
            if (hour < 14) targetDate.setDate(targetDate.getDate() - 1);

            const tM = targetDate.getMonth() + 1;
            const tD = targetDate.getDate();
            const tY = targetDate.getFullYear();

            return validData.find(d => {
                if (!d.game.includes(game)) return false;
                if (!matchSchedule(d.date, targetSchedule)) return false;
                return matchDateStr(d.date, tM, tD, tY);
            });
        }
        return validData.find(d => d.game.includes(game));
    }

    function getTodayDraw(validData, game, schedule) {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const pht = new Date(utc + (3600000 * 8));
        const tM = pht.getMonth() + 1;
        const tD = pht.getDate();
        const tY = pht.getFullYear();

        return validData.find(d => {
            if (!d.game.includes(game)) return false;
            if (!matchSchedule(d.date, schedule)) return false;
            return matchDateStr(d.date, tM, tD, tY);
        });
    }

    function getDurationDraws(validData, game, from, to, schedule) {
        const startDate = new Date(from + "T00:00:00"); // Force local timezone
        const endDate = new Date(to + "T00:00:00");
        let draws = [];
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const tM = d.getMonth() + 1;
            const tD = d.getDate();
            const tY = d.getFullYear();
            
            if (schedule === 'ALL') {
                // FIX: Use .filter() to grab ALL 3 draws for 2D/3D, not just the first one!
                const matches = validData.filter(dr => {
                    if (!dr.game.includes(game)) return false;
                    return matchDateStr(dr.date, tM, tD, tY);
                });
                draws.push(...matches); 
            } else {
                // Find exact schedule match
                const match = validData.find(dr => {
                    if (!dr.game.includes(game)) return false;
                    if (!matchSchedule(dr.date, schedule)) return false;
                    return matchDateStr(dr.date, tM, tD, tY);
                });
                if (match) draws.push(match);
            }
        }
        return draws;
    }

    function getLatestDraw(validData, game) {
        if (game === '3D' || game === '2D') {
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const pht = new Date(utc + (3600000 * 8));
            const hour = pht.getHours();
            let targetSchedule = '9PM'; 
            if (hour >= 21) targetSchedule = '9PM';
            else if (hour >= 17) targetSchedule = '5PM';
            else if (hour >= 14) targetSchedule = '2PM';
            
            let targetDate = new Date(pht);
            if (hour < 14) targetDate.setDate(targetDate.getDate() - 1); // Before 2PM, get yesterday's 9PM

            const tM = targetDate.getMonth() + 1;
            const tD = targetDate.getDate();
            const tY = targetDate.getFullYear();

            return validData.find(d => {
                if (!d.game.includes(game)) return false;
                if (!d.date.includes(targetSchedule)) return false;
                return matchDateStr(d.date, tM, tD, tY);
            });
        }
        // Major games just return the absolute latest
        return validData.find(d => d.game.includes(game));
    }

    function getTodayDraw(validData, game, schedule) {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const pht = new Date(utc + (3600000 * 8));
        const tM = pht.getMonth() + 1;
        const tD = pht.getDate();
        const tY = pht.getFullYear();

        return validData.find(d => {
            if (!d.game.includes(game)) return false;
            if (!d.date.includes(schedule)) return false;
            return matchDateStr(d.date, tM, tD, tY);
        });
    }

    function getDurationDraws(validData, game, from, to, schedule) {
        const startDate = new Date(from + "T00:00:00"); // Force local timezone
        const endDate = new Date(to + "T00:00:00");
        let draws = [];
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const tM = d.getMonth() + 1;
            const tD = d.getDate();
            const tY = d.getFullYear();
            
            if (schedule === 'ALL') {
                // MAJOR GAMES: Just find the draw for this date (ignore schedules)
                const match = validData.find(dr => {
                    if (!dr.game.includes(game)) return false;
                    return matchDateStr(dr.date, tM, tD, tY);
                });
                if (match) draws.push(match);
            } else {
                // DIGIT GAMES (2D/3D): Find draw for this date AND specific schedule
                const match = validData.find(dr => {
                    if (!dr.game.includes(game)) return false;
                    if (!dr.date.includes(schedule)) return false;
                    return matchDateStr(dr.date, tM, tD, tY);
                });
                if (match) draws.push(match);
            }
        }
        return draws;
    }
    // --- CAPTURE FUNCTIONS ---
    
    // 1. Weekly Blueprint
    async function handleWeeklyBlueprint() {
        const validData = getValidData(window.allData);
        const sorted = [...validData].sort((a, b) => new Date(b.date) - new Date(a.date));
        const zip = new JSZip();
        const startDate = new Date();
        const wrapper = document.getElementById('cs_forecast_wrapper');
        const target = document.getElementById('cs_forecast_target');

        for (let i = 0; i < 30; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            const dayOfWeek = currentDate.getDay();
            const scheduledGames = BLUEPRINT_SCHEDULE[dayOfWeek] || [];
            for (const game of scheduledGames) {
                const nums = generateSmartNumbers(sorted, game);
                if (nums.length === 0) continue;
                document.getElementById('cs_fc_date').textContent = "Weekly Blueprint";
                document.getElementById('cs_fc_game').textContent = GAME_NAMES[game];
                const ballsContainer = document.getElementById('cs_fc_balls');
                ballsContainer.innerHTML = '';
                const color = GAME_COLORS_HEX[game] || 'rgba(37, 99, 235, 0.60)';
                nums.forEach(n => { ballsContainer.innerHTML += `<div style="width: 118px; height: 118px; background: ${color}; border-radius: 9999px; border: 6px solid rgba(255,255,255,0.20); display: flex; justify-content: center; align-items: center; flex-shrink: 0;"><span style="color: white; font-size: 52px; font-weight: 700; line-height: 1; letter-spacing: 2.60px;">${n}</span></div>`; });
                wrapper.style.left = '0'; wrapper.style.opacity = '1';
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                await new Promise(resolve => setTimeout(resolve, 150));
                const dataUrl = await htmlToImage.toPng(target, { quality: 1.0, pixelRatio: 2, backgroundColor: '#101E44', skipFonts: true });
                wrapper.style.left = '-9999px';
                const filename = `Blueprint_${formatDateFilename(currentDate)}_${cleanGameName(game)}.png`;
                zip.file(filename, dataUrl.split(',')[1], { base64: true });
            }
        }
        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement('a'); link.href = URL.createObjectURL(content); link.download = `Weekly_Blueprint.zip`; link.click();
    }

    // 2. Batch Forecast
    async function handleBatchForecast() {
        const validData = getValidData(window.allData);
        const sorted = [...validData].sort((a, b) => new Date(b.date) - new Date(a.date));
        const zip = new JSZip();
        const startDate = new Date();
        const wrapper = document.getElementById('cs_forecast_wrapper');
        const target = document.getElementById('cs_forecast_target');
        for (let i = 0; i < 14; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            const dayOfWeek = currentDate.getDay();
            const scheduledGames = SCHEDULE_MAP[dayOfWeek] || [];
            for (const game of scheduledGames) {
                const nums = generateSmartNumbers(sorted, game);
                if (nums.length === 0) continue;
                const dateString = currentDate.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                document.getElementById('cs_fc_date').textContent = dateString;
                document.getElementById('cs_fc_game').textContent = GAME_NAMES[game];
                const ballsContainer = document.getElementById('cs_fc_balls');
                ballsContainer.innerHTML = '';
                const color = GAME_COLORS_HEX[game] || 'rgba(37, 99, 235, 0.60)';
                nums.forEach(n => { ballsContainer.innerHTML += `<div style="width: 118px; height: 118px; background: ${color}; border-radius: 9999px; border: 6px solid rgba(255,255,255,0.20); display: flex; justify-content: center; align-items: center; flex-shrink: 0;"><span style="color: white; font-size: 52px; font-weight: 700; line-height: 1; letter-spacing: 2.60px;">${n}</span></div>`; });
                wrapper.style.left = '0'; wrapper.style.opacity = '1';
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                await new Promise(resolve => setTimeout(resolve, 150));
                const dataUrl = await htmlToImage.toPng(target, { quality: 1.0, pixelRatio: 2, backgroundColor: '#101E44', skipFonts: true });
                wrapper.style.left = '-9999px';
                const filename = `${formatDateFilename(currentDate)}_${cleanGameName(game)}.png`;
                zip.file(filename, dataUrl.split(',')[1], { base64: true });
            }
        }
        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement('a'); link.href = URL.createObjectURL(content); link.download = `Forecast_Batch.zip`; link.click();
    }

    // Placeholders for your other functions
    async function handleDailyResults() {
            const validData = getValidData(window.allData); const sorted = [...validData].sort((a, b) => new Date(b.date) - new Date(a.date));
            // Note: Update wrapper IDs if yours are different
            const dataUrl = await snapWrapper('cs_daily_wrapper', 'cs_daily_target');
            if(dataUrl) triggerDownload(dataUrl, `Daily_Roundup.png`);
        }
        async function handle2D3DCombined() {
        // 1. GET DATA & SETUP PHT TIME
        const validData = getValidData(window.allData);
        const sorted = [...validData].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const pht = new Date(utc + (3600000 * 8));
        const tM = pht.getMonth() + 1, tD = pht.getDate(), tY = pht.getFullYear();
        const formattedDate = pht.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        // 2. GET THE SELECTED SCHEDULE (2PM, 5PM, or 9PM)
        const selectedSchedule = schedSel.value; 

        // 3. INJECT HEADER INFO
        document.getElementById('cs_2d3d_date').textContent = formattedDate;
        document.getElementById('cs_2d3d_schedule').textContent = `${selectedSchedule} DAILY DRAW`;

        // 4. FIND & INJECT 2D DATA
        // We use matchSchedule() to find the 2D draw that matches the dropdown (e.g., "2PM")
        const draw2D = sorted.find(d => 
            d.game.includes('2D') && 
            matchSchedule(d.date, selectedSchedule) && 
            matchDateStr(d.date, tM, tD, tY)
        );

        const container2D = document.getElementById('cs_2d3d_2d_balls');
        container2D.innerHTML = ''; // Clear old balls
        
        if (draw2D) {
            const color2D = GAME_COLORS_HEX['2D'];
            // Generate exactly 2 balls for 2D
            container2D.innerHTML = safeParseCombination(draw2D.combination)
                .map(n => `<div class="screenshot-ball-wrap"><div class="screenshot-ball" style="background: ${color2D};">${n}</div></div>`)
                .join('');
        }

        // 5. FIND & INJECT 3D DATA
        const draw3D = sorted.find(d => 
            d.game.includes('3D') && 
            matchSchedule(d.date, selectedSchedule) && 
            matchDateStr(d.date, tM, tD, tY)
        );

        const container3D = document.getElementById('cs_2d3d_3d_balls');
        container3D.innerHTML = ''; // Clear old balls
        
        if (draw3D) {
            const color3D = GAME_COLORS_HEX['3D'];
            // Generate exactly 3 balls for 3D
            container3D.innerHTML = safeParseCombination(draw3D.combination)
                .map(n => `<div class="screenshot-ball-wrap"><div class="screenshot-ball" style="background: ${color3D};">${n}</div></div>`)
                .join('');
        }

        // Failsafe if no draw exists yet for that time
        if (!draw2D && !draw3D) {
            return alert(`No 2D/3D data found for ${selectedSchedule} today.`);
        }

        // 6. SNAP & DOWNLOAD
        // Background is #101E44 based on your PHP file
        const dataUrl = await snapWrapper('cs_2d3d_wrapper', 'cs_2d3d_target', '#101E44');
        if(dataUrl) {
            triggerDownload(dataUrl, `Combined_2D3D_${selectedSchedule.replace(':', '')}_${formatDateFilename(pht)}.png`);
        }
    }
        async function handleSummaryWinners() {
        // 1. GET DATA
        const game = gameSel.value; 
        const validData = getValidData(window.allData);
        const sorted = [...validData].sort((a, b) => new Date(b.date) - new Date(a.date));
        const latest = sorted.find(d => d.game.includes(game)); 
        
        if (!latest) return alert(`No data found for ${GAME_NAMES[game] || game}`);

        // 2. EXTRACT & FORMAT
        const formattedDate = new Date(latest.date.split(' ')[0]).toLocaleDateString('en-PH', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
        const gameName = GAME_NAMES[game] || game;
        const color = GAME_COLORS_HEX[game] || 'rgba(37, 99, 235, 0.60)';

        // 3. INJECT: Header & Balls
        document.getElementById('cs_winners_date').textContent = formattedDate;
        document.getElementById('cs_winners_game').textContent = gameName;
        
        document.getElementById('cs_winners_balls').innerHTML = safeParseCombination(latest.combination)
            .map(n => `<div class="screenshot-ball-wrap"><div class="screenshot-ball" style="background: ${color};">${n}</div></div>`)
            .join('');

        // 4. INJECT: Prize Breakdowns (Using fallbacks for missing data)
        // Jackpot
        document.getElementById('cs_winners_1st_prize').textContent = latest.jackpot_prize || latest.prize || "Prize N/A";
        const jackpotWinners = parseInt(latest.winners) || 0;
        document.getElementById('cs_winners_1st_winners').textContent = `${jackpotWinners} Winner${jackpotWinners !== 1 ? 's' : ''}`;

        // 2nd Prize (Falls back to N/A if your JSON doesn't track this)
        document.getElementById('cs_winners_2nd_prize').textContent = latest.prize_2nd || "Prize N/A";
        const winners2nd = parseInt(latest.winners_2nd) || 0;
        document.getElementById('cs_winners_2nd_winners').textContent = `${winners2nd} Winner${winners2nd !== 1 ? 's' : ''}`;

        // 3rd Prize
        document.getElementById('cs_winners_3rd_prize').textContent = latest.prize_3rd || "Prize N/A";
        const winners3rd = parseInt(latest.winners_3rd) || 0;
        document.getElementById('cs_winners_3rd_winners').textContent = `${winners3rd} Winner${winners3rd !== 1 ? 's' : ''}`;

        // 4th Prize
        document.getElementById('cs_winners_4th_prize').textContent = latest.prize_4th || "Prize N/A";
        const winners4th = parseInt(latest.winners_4th) || 0;
        document.getElementById('cs_winners_4th_winners').textContent = `${winners4th} Winner${winners4th !== 1 ? 's' : ''}`;

        // 5. SNAP & DOWNLOAD
        const dataUrl = await snapWrapper('cs_winners_wrapper', 'cs_winners_target', '#111E44');
        if(dataUrl) triggerDownload(dataUrl, `Winners_${cleanGameName(game)}.png`);
    }
        async function handleJackpotAlert() {
        // 1. GET DATA
        const game = gameSel.value; 
        const validData = getValidData(window.allData);
        const sorted = [...validData].sort((a, b) => new Date(b.date) - new Date(a.date));
        const latest = sorted.find(d => d.game.includes(game)); 
        
        if (!latest) return alert(`No data found for ${GAME_NAMES[game] || game}`);

        // 2. EXTRACT & FORMAT
        const formattedDate = new Date(latest.date.split(' ')[0]).toLocaleDateString('en-PH', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
        const gameName = GAME_NAMES[game] || game;
        const currentPrizeStr = latest.jackpot_prize || latest.prize || "₱ 0.00";

        // 3. INJECT HEADER & PRIZE
        document.getElementById('cs_ja_date').textContent = formattedDate;
        document.getElementById('cs_ja_game').textContent = gameName;
        document.getElementById('cs_ja_prize').textContent = currentPrizeStr;

        // 4. ADVANCED LOGIC: CALCULATE & SHOW ROLLOVER
        const rolloverContainer = document.getElementById('cs_ja_rollover_container');
        const winnersCount = parseInt(latest.winners) || 0;

        if (winnersCount === 0) {
            // No one won! Find the previous draw to calculate the increase.
            // Since 'sorted' is newest first, the previous draw is index 1 (index 0 is the latest).
            const previousDraw = sorted.find(d => d.game.includes(game) && d !== latest);
            
            if (previousDraw) {
                const prevPrizeStr = previousDraw.jackpot_prize || previousDraw.prize || "₱ 0.00";
                
                // Strip currency symbols and commas to do math (e.g., "₱ 75,000,000.00" -> 75000000)
                const cleanCurr = parseInt(currentPrizeStr.replace(/[^0-9]/g, ''), 10) || 0;
                const cleanPrev = parseInt(prevPrizeStr.replace(/[^0-9]/g, ''), 10) || 0;
                
                const increase = cleanCurr - cleanPrev;
                
                if (increase > 0) {
                    // Format the increase back to a readable string
                    const formattedIncrease = "₱ " + increase.toLocaleString('en-PH', { minimumFractionDigits: 2 });
                    document.getElementById('cs_ja_rollover_amount').textContent = formattedIncrease;
                    
                    // Unhide the container so it shows on the screenshot!
                    rolloverContainer.style.display = 'block'; 
                }
            }
        } else {
            // Someone won the jackpot! Hide the rollover container.
            rolloverContainer.style.display = 'none';
        }

        // 5. SNAP & DOWNLOAD
        // Background is #101E44 based on your PHP file
        const dataUrl = await snapWrapper('cs_jackpot_alert_wrapper', 'cs_jackpot_alert_target', '#101E44');
        if(dataUrl) triggerDownload(dataUrl, `Jackpot_${cleanGameName(game)}.png`);
    }
        // --- CAPTURE SYSTEM HELPERS ---
    async function snapWrapper(wrapperId, targetId, bgColor = '#101E44') {
        const wrapper = document.getElementById(wrapperId); 
        const target = document.getElementById(targetId);
        
        wrapper.style.left = '0'; 
        wrapper.style.opacity = '1';
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await new Promise(resolve => setTimeout(resolve, 150));
        
        const dataUrl = await htmlToImage.toPng(target, { 
            quality: 1.0, 
            pixelRatio: 2, 
            backgroundColor: bgColor, 
            skipFonts: true 
        });
        
        wrapper.style.left = '-9999px'; 
        return dataUrl;
    }
        // --- REBUILT CAPTURE FUNCTIONS ---

    async function handleSingleCapture() {
        const game = gameSel.value; 
        const validData = getValidData(window.allData); 
        const sorted = [...validData].sort((a, b) => new Date(b.date) - new Date(a.date));
        const latest = sorted.find(d => d.game.includes(game)); 
        if (!latest) return alert("No data found.");
        
        const formattedDate = new Date(latest.date.split(' ')[0]).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const prizeValue = latest.jackpot_prize || latest.prize || "Prize N/A";
        
        document.getElementById('cs_sc_date').textContent = formattedDate;
        document.getElementById('cs_sc_game').textContent = GAME_NAMES[game] || game;
        document.getElementById('cs_sc_prize').textContent = prizeValue;
        
        const ballsContainer = document.getElementById('cs_sc_balls');
        const color = GAME_COLORS_HEX[game] || 'rgba(37, 99, 235, 0.60)';
        ballsContainer.innerHTML = '';
        safeParseCombination(latest.combination).forEach(n => {
            ballsContainer.innerHTML += `<div class="screenshot-ball-wrap"><div class="screenshot-ball" style="background: ${color};">${n}</div></div>`;
        });

        const dataUrl = await snapWrapper('cs_screenshot_wrapper', 'cs_capture_target', '#101E44'); 
        if(dataUrl) triggerDownload(dataUrl, `Single_${cleanGameName(game)}.png`);
    }

        async function handleDailyResults() {
        const validData = getValidData(window.allData);
        const sorted = [...validData].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // 1. SMART DATE HEADER
        // Find the newest draw overall to set the date. 
        // (e.g., If it's 8 AM Wednesday, this will say "Tuesday, March 31")
        const newestDrawOverall = sorted[0];
        const formattedDate = new Date(newestDrawOverall.date.split(' ')[0]).toLocaleDateString('en-PH', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
        document.getElementById('cs_daily_timestamp').textContent = formattedDate;

        // 2. MAJOR GAMES (Fills slots without breaking the design)
        const majorContainer = document.getElementById('cs_daily_major_container');
        majorContainer.innerHTML = ''; 
        const majorGames = ['6/58', '6/55', '6/49', '6/45', '6/42'];
        
        majorGames.forEach(game => {
            // .find() automatically grabs the absolute newest draw for this game.
            // If it happened today, great. If it happened yesterday, it uses yesterday. Design stays safe.
            const latestDraw = sorted.find(d => d.game.includes(game));
            
            if (latestDraw) {
                const color = GAME_COLORS_HEX[game] || 'rgba(37, 99, 235, 0.60)';
                const prize = latestDraw.jackpot_prize || latestDraw.prize || "";
                majorContainer.innerHTML += `
                    <div style="margin-bottom: 35px; text-align: center;">
                        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 15px;">
                            <span style="color: white; font-size: 26px; font-weight: 700;">${GAME_NAMES[game]}</span>
                            <span style="color: #FACC15; font-size: 22px; font-weight: 700;">${prize}</span>
                        </div>
                        <div style="display: flex; justify-content: center; gap: 12px;">
                            ${safeParseCombination(latestDraw.combination).map(n => `<div class="screenshot-ball-wrap"><div class="screenshot-ball" style="background: ${color};">${n}</div></div>`).join('')}
                        </div>
                    </div>`;
            }
        });

        // 3. DAILY DRAWS 2D/3D (Fills slots without breaking the design)
        const schedules = ['2PM', '5PM', '9PM'];
        const twoDContainer = document.getElementById('cs_daily_2d_container');
        const threeDContainer = document.getElementById('cs_daily_3d_container');
        twoDContainer.innerHTML = ''; 
        threeDContainer.innerHTML = '';

        schedules.forEach(sched => {
            // Grabs the newest 2PM draw. If it's after 2PM, it's from today. If before 2PM, it falls back to yesterday.
            const draw2D = sorted.find(d => d.game.includes('2D') && matchSchedule(d.date, sched));
            if (draw2D) {
                const c = GAME_COLORS_HEX['2D']; 
                twoDContainer.innerHTML += `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <div>
                            <div style="color: rgba(255,255,255,0.60); font-size: 18px;">${sched}</div>
                            <div style="display: flex; gap: 10px; margin-top: 5px;">
                                ${safeParseCombination(draw2D.combination).map(n => `<div class="screenshot-ball-wrap"><div class="screenshot-ball" style="background: ${c};">${n}</div></div>`).join('')}
                            </div>
                        </div>
                    </div>`;
            }

            // Grabs the newest 5PM/9PM draw (Same fallback logic)
            const draw3D = sorted.find(d => d.game.includes('3D') && matchSchedule(d.date, sched));
            if (draw3D) {
                const c = GAME_COLORS_HEX['3D']; 
                threeDContainer.innerHTML += `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <div>
                            <div style="color: rgba(255,255,255,0.60); font-size: 18px;">${sched}</div>
                            <div style="display: flex; gap: 10px; margin-top: 5px;">
                                ${safeParseCombination(draw3D.combination).map(n => `<div class="screenshot-ball-wrap"><div class="screenshot-ball" style="background: ${c};">${n}</div></div>`).join('')}
                            </div>
                        </div>
                    </div>`;
            }
        });

        // 4. SNAP & DOWNLOAD
        const dataUrl = await snapWrapper('cs_daily_wrapper', 'cs_daily_target', '#111E44');
        if(dataUrl) triggerDownload(dataUrl, `Latest_Roundup.png`);
    }

    async function handle2D3DCombined() {
        const validData = getValidData(window.allData);
        const sorted = [...validData].sort((a, b) => new Date(b.date) - new Date(a.date));
        const now = new Date(); const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const pht = new Date(utc + (3600000 * 8));
        const tM = pht.getMonth() + 1, tD = pht.getDate(), tY = pht.getFullYear();
        const formattedDate = pht.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const selectedSchedule = schedSel.value; 

        document.getElementById('cs_2d3d_date').textContent = formattedDate;
        document.getElementById('cs_2d3d_schedule').textContent = `${selectedSchedule} DAILY DRAW`;

        const draw2D = sorted.find(d => d.game.includes('2D') && matchSchedule(d.date, selectedSchedule) && matchDateStr(d.date, tM, tD, tY));
        const container2D = document.getElementById('cs_2d3d_2d_balls'); container2D.innerHTML = '';
        if (draw2D) { const c = GAME_COLORS_HEX['2D']; container2D.innerHTML = safeParseCombination(draw2D.combination).map(n => `<div class="screenshot-ball-wrap"><div class="screenshot-ball" style="background: ${c};">${n}</div></div>`).join(''); }

        const draw3D = sorted.find(d => d.game.includes('3D') && matchSchedule(d.date, selectedSchedule) && matchDateStr(d.date, tM, tD, tY));
        const container3D = document.getElementById('cs_2d3d_3d_balls'); container3D.innerHTML = '';
        if (draw3D) { const c = GAME_COLORS_HEX['3D']; container3D.innerHTML = safeParseCombination(draw3D.combination).map(n => `<div class="screenshot-ball-wrap"><div class="screenshot-ball" style="background: ${c};">${n}</div></div>`).join(''); }

        if (!draw2D && !draw3D) return alert(`No 2D/3D data for ${selectedSchedule} today.`);
        const dataUrl = await snapWrapper('cs_2d3d_wrapper', 'cs_2d3d_target', '#101E44');
        if(dataUrl) triggerDownload(dataUrl, `Combined_2D3D_${selectedSchedule.replace(':', '')}_${formatDateFilename(pht)}.png`);
    }

    async function handleSummaryWinners() {
        const game = gameSel.value; const validData = getValidData(window.allData); const sorted = [...validData].sort((a, b) => new Date(b.date) - new Date(a.date));
        const latest = sorted.find(d => d.game.includes(game)); 
        if (!latest) return alert(`No data found for ${GAME_NAMES[game] || game}`);
        const formattedDate = new Date(latest.date.split(' ')[0]).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const gameName = GAME_NAMES[game] || game; const color = GAME_COLORS_HEX[game] || 'rgba(37, 99, 235, 0.60)';

        document.getElementById('cs_winners_date').textContent = formattedDate;
        document.getElementById('cs_winners_game').textContent = gameName;
        document.getElementById('cs_winners_balls').innerHTML = safeParseCombination(latest.combination).map(n => `<div class="screenshot-ball-wrap"><div class="screenshot-ball" style="background: ${color};">${n}</div></div>`).join('');

        document.getElementById('cs_winners_1st_prize').textContent = latest.jackpot_prize || latest.prize || "Prize N/A";
        const w1 = parseInt(latest.winners) || 0; document.getElementById('cs_winners_1st_winners').textContent = `${w1} Winner${w1 !== 1 ? 's' : ''}`;
        document.getElementById('cs_winners_2nd_prize').textContent = latest.prize_2nd || "Prize N/A";
        const w2 = parseInt(latest.winners_2nd) || 0; document.getElementById('cs_winners_2nd_winners').textContent = `${w2} Winner${w2 !== 1 ? 's' : ''}`;
        document.getElementById('cs_winners_3rd_prize').textContent = latest.prize_3rd || "Prize N/A";
        const w3 = parseInt(latest.winners_3rd) || 0; document.getElementById('cs_winners_3rd_winners').textContent = `${w3} Winner${w3 !== 1 ? 's' : ''}`;
        document.getElementById('cs_winners_4th_prize').textContent = latest.prize_4th || "Prize N/A";
        const w4 = parseInt(latest.winners_4th) || 0; document.getElementById('cs_winners_4th_winners').textContent = `${w4} Winner${w4 !== 1 ? 's' : ''}`;

        const dataUrl = await snapWrapper('cs_winners_wrapper', 'cs_winners_target', '#111E44');
        if(dataUrl) triggerDownload(dataUrl, `Winners_${cleanGameName(game)}.png`);
    }

    async function handleJackpotAlert() {
        const game = gameSel.value; const validData = getValidData(window.allData); const sorted = [...validData].sort((a, b) => new Date(b.date) - new Date(a.date));
        const latest = sorted.find(d => d.game.includes(game)); 
        if (!latest) return alert(`No data found for ${GAME_NAMES[game] || game}`);
        const formattedDate = new Date(latest.date.split(' ')[0]).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const gameName = GAME_NAMES[game] || game; const currentPrizeStr = latest.jackpot_prize || latest.prize || "₱ 0.00";

        document.getElementById('cs_ja_date').textContent = formattedDate;
        document.getElementById('cs_ja_game').textContent = gameName;
        document.getElementById('cs_ja_prize').textContent = currentPrizeStr;

        const rolloverContainer = document.getElementById('cs_ja_rollover_container');
        const winnersCount = parseInt(latest.winners) || 0;

        if (winnersCount === 0) {
            const previousDraw = sorted.find(d => d.game.includes(game) && d !== latest);
            if (previousDraw) {
                const prevPrizeStr = previousDraw.jackpot_prize || previousDraw.prize || "₱ 0.00";
                const cleanCurr = parseInt(currentPrizeStr.replace(/[^0-9]/g, ''), 10) || 0;
                const cleanPrev = parseInt(prevPrizeStr.replace(/[^0-9]/g, ''), 10) || 0;
                const increase = cleanCurr - cleanPrev;
                if (increase > 0) {
                    document.getElementById('cs_ja_rollover_amount').textContent = "₱ " + increase.toLocaleString('en-PH', { minimumFractionDigits: 2 });
                    rolloverContainer.style.display = 'block'; 
                }
            }
        } else { rolloverContainer.style.display = 'none'; }

        const dataUrl = await snapWrapper('cs_jackpot_alert_wrapper', 'cs_jackpot_alert_target', '#101E44');
        if(dataUrl) triggerDownload(dataUrl, `Jackpot_${cleanGameName(game)}.png`);
    }

    // --- ANALYSIS CAPTURE SYSTEM ---
    async function renderSingleAnalysisImage(latest, game) {
        if (!latest) return null;
        const combination = latest.combination;
        const cleanDateStr = latest.date.split(' ')[0]; 
        const formattedDate = new Date(cleanDateStr).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const prizeValue = latest.jackpot_prize || latest.prize || "Prize N/A";

        const response = await fetch(`api_analyze.php?game=${encodeURIComponent(latest.game)}&combination=${encodeURIComponent(combination)}`);
        const textResponse = await response.text();
        let data;
        try { data = JSON.parse(textResponse); } catch (e) { throw new Error("PHP ERROR: " + textResponse.substring(0, 200)); }
        if (!data.success) throw new Error(data.error);

        const wrapper = document.getElementById('cs_analysis_wrapper');
        const target = document.getElementById('cs_analysis_target');

        document.getElementById('cs_an_game').textContent = GAME_NAMES[game];
        document.getElementById('cs_an_date').textContent = formattedDate + (latest.date.includes('PM') ? ' - ' + latest.date.split(' ').pop() : '');
        // document.getElementById('cs_an_prize').textContent = prizeValue;

        const ballsContainer = document.getElementById('cs_an_balls');
        ballsContainer.innerHTML = '';
        const color = GAME_COLORS_HEX[game] || 'rgba(147, 51, 234, 0.60)';
        safeParseCombination(combination).forEach(n => {
            ballsContainer.innerHTML += `<div style="width: 113px; height: 113px; position: relative; background: ${color}; border-radius: 9999px; border: 6px rgba(255,255,255,0.20) solid; flex-shrink: 0;"><div style="width: 88px; height: 60px; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: white; font-size: 44px; font-weight: 700; letter-spacing: 2.20px; line-height: 60px;">${n}</div></div>`;
        });

        const microGrid = document.getElementById('cs_an_micro_grid');
            microGrid.innerHTML = '';
            
            // Trick: Take the game color (e.g. "rgba(37, 99, 235, 0.60)") and change 0.60 to 0.4
            const microColor = color.replace(/,\s*[\d.]+\)$/, ', 0.4)');

            data.micro.forEach(item => {
                let statusText = ''; let subText = '';
                if (item.status === 'Hot') { statusText = '🔥 HOT'; subText = 'High Occurrence'; }
                if (item.status === 'Cold') { statusText = '❄️ COLD'; subText = 'Low Occurrence'; }
                if (item.status === 'Warm') { statusText = '🌡️ WARM'; subText = 'Avg Occurrence'; }
                let seenText = item.last_seen === 0 ? 'recently' : `${item.last_seen} draws ago`;
                
                microGrid.innerHTML += `
                <div class="flex items-center gap-4">
                    <div class="w-20 h-20 rounded-full border-4 border-white/20 shrink-0 flex items-center justify-center text-white text-3xl font-bold font-['Montserrat'] leading-5 tracking-wider" style="background: ${microColor};">${item.number}</div>
                    
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <div style="display: flex; align-items: baseline; gap: 5px;">
                            <span class="text-white text-2xl font-semibold font-['Montserrat'] leading-8 tracking-wider">${statusText}</span>
                            <span class="text-white/50 text-xl font-semibold font-['Montserrat'] leading-8 tracking-wide">(${subText})</span>
                        </div>
                        <div style="display: flex; align-items: baseline; gap: 5px;">
                            <span class="text-white text-2xl font-normal font-['Montserrat'] leading-8 tracking-wide">Last seen</span>
                            <span class="text-white text-2xl font-semibold font-['Montserrat'] leading-8 tracking-wider">${seenText}</span>
                        </div>
                    </div>
                </div>`;
            });

                        // 4. Inject Relational Data
            const relContainer = document.getElementById('cs_an_relations');
relContainer.innerHTML = '';
const relData = Array.isArray(data.relational) ? data.relational : [];

if (relData.length === 0) {

    relContainer.innerHTML = `<div class="text-center text-white text-xl font-normal font-['Montserrat'] leading-4 tracking-wide">✅ Clean Draw - No major patterns detected.</div>`;
} else {
    relData.forEach(item => {
        if (typeof item !== 'string') return; 
        
        // FIX: Added margin: 0 8px to force spacing in the screenshot
        let formattedDesc = item.replace(/(\d+)/g, `<span class="text-2xl font-bold font-['Montserrat'] leading-4" style="margin: 0 10px;">$1</span>`);
        
        // FIX 2: Added 'justify-content: center;' to the inline flex style
        relContainer.innerHTML += `<div class="text-white text-xl font-normal font-['Montserrat'] leading-4 tracking-wide" style="display: flex; align-items: baseline; justify-content: center; white-space: nowrap;">✅ ${formattedDesc}</div>`;
    });
}


        wrapper.style.left = '0'; wrapper.style.opacity = '1';
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await new Promise(resolve => setTimeout(resolve, 150));
        const dataUrl = await htmlToImage.toPng(target, { quality: 1.0, pixelRatio: 2, backgroundColor: '#111E44', skipFonts: true });
        wrapper.style.left = '-9999px';
        return dataUrl;
    }

    async function handleAnalysisCapture() {
        const validData = getValidData(window.allData);
        const sorted = [...validData].sort((a, b) => new Date(b.date) - new Date(a.date));
        const game = gameSel.value;
        const mode = document.getElementById('cs_analysis_mode').value;

        try {
            if (mode === 'latest') {
                const draw = getLatestDraw(sorted, game);
                if (!draw) return alert("No latest draw found.");
                const dataUrl = await renderSingleAnalysisImage(draw, game);
                if(dataUrl) triggerDownload(dataUrl, `Analysis_Latest_${cleanGameName(game)}.png`);
            } else if (mode === 'today') {
                const schedule = document.getElementById('cs_analysis_today_schedule').value;
                const draw = getTodayDraw(sorted, game, schedule);
                if (!draw) return alert(`No draw found for Today's ${schedule} schedule.`);
                const dataUrl = await renderSingleAnalysisImage(draw, game);
                if(dataUrl) triggerDownload(dataUrl, `Analysis_Today_${schedule}_${cleanGameName(game)}.png`);
            } else if (mode === 'duration') {
                const from = document.getElementById('cs_analysis_from').value;
                const to = document.getElementById('cs_analysis_to').value;
                if (!from || !to) return alert("Please select From and To dates.");
                const schedule = (game === '3D' || game === '2D') ? document.getElementById('cs_analysis_duration_schedule').value : 'ALL';
                const draws = getDurationDraws(sorted, game, from, to, schedule);
                
                if (draws.length === 0) return alert("No draws found in this date range.");
                if (draws.length === 1) {
                    const dataUrl = await renderSingleAnalysisImage(draws[0], game);
                    if(dataUrl) triggerDownload(dataUrl, `Analysis_Duration_${cleanGameName(game)}.png`);
                    return;
                }
                const zip = new JSZip();
                for (const draw of draws) {
                    const dataUrl = await renderSingleAnalysisImage(draw, game);
                    if (dataUrl) {
                        const filename = `Analysis_${draw.date.replace(/[\s/]/g, '_')}_${cleanGameName(game)}.png`;
                        zip.file(filename, dataUrl.split(',')[1], { base64: true });
                    }
                }
                const content = await zip.generateAsync({ type: "blob" });
                triggerDownload(URL.createObjectURL(content), `Analysis_Batch_${cleanGameName(game)}.zip`);
            }
        } catch (error) {
            console.error(error);
            alert("Failed to generate analysis: " + error.message);
        }
    }


    function triggerDownload(href, filename) {
        const link = document.createElement('a');
        link.href = href;
        link.download = filename;
        link.click();
    }
    

    // --- BIND EVENTS ---
    catSel.addEventListener('change', updateTypes);
    typeSel.addEventListener('change', updateUI);
    gameSel.addEventListener('change', updateUI); 
    const analysisMode = document.getElementById('cs_analysis_mode');
    if(analysisMode) analysisMode.addEventListener('change', updateUI);
    document.getElementById('cs_fetch_btn').addEventListener('click', handleFetch);
    document.getElementById('cs_generate_btn').addEventListener('click', handleGenerate);

    // INIT
    updateTypes();
    console.log("✅ STUDIO READY");
}
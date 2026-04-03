<!-- Hidden off-screen initially -->
<div id="cs_analysis_wrapper" style="position: absolute; top: 0; left: -9999px; opacity: 0; z-index: -1;">
    
    <div id="cs_analysis_target" class="w-[1080px] h-[1350px] relative" style="background: #111E44">
        
        <!-- Fixed Header -->
        <div class="w-[682px] h-20 left-[199px] top-[90px] absolute text-center"><span class="text-white text-7xl font-extrabold font-['Montserrat']">Lottong</span><span class="text-blue-500 text-7xl font-extrabold font-['Montserrat']"> Pinoy</span></div>
        <div class="w-[672px] left-[209px] top-[191px] absolute text-center text-white/80 text-3xl font-bold font-['Montserrat'] tracking-[7.13px]">DRAW ANALYSIS</div>
        
        <!-- Fixed Images (Paths corrected for your tree) -->
        <img class="w-32 h-32 left-[64px] top-[64px] absolute" src="img/icon-192x192.png" />
        <img class="w-32 h-32 left-[880px] top-[64px] absolute" src="img/qrcode.png" />

        <!-- Dynamic Header Info -->
        <div id="cs_an_date" class="w-[1080px] left-0 top-[245px] absolute text-center text-white text-3xl font-bold font-['Montserrat'] tracking-[2.80px]">Loading Date...</div>
        <div id="cs_an_game" class="w-[1080px] h-14 left-0 top-[310px] absolute text-center text-white text-6xl font-extrabold font-['Montserrat']">LOADING GAME</div>
        <!-- <div id="cs_an_prize" class="w-[1080px] left-0 top-[350px] absolute text-center text-yellow-400 text-3xl font-bold font-['Montserrat'] tracking-tight">₱ 0.00</div> -->

        <!-- Dynamic Balls (Flexbox prevents overlap) -->
        <div id="cs_an_balls" style="position: absolute; top: 390px; left: 0; width: 1080px; display: flex; justify-content: center; gap: 25px;">
            <!-- JS Injects Here -->
        </div>

        <!-- Micro Section Title -->
        <div class="w-[1080px] left-0 top-[566px] absolute text-center text-white text-3xl font-bold font-['Montserrat'] leading-5 tracking-wider">Individual behavior of each number</div>

        <!-- Dynamic Micro Grid (CSS Grid prevents overlap) -->
        <div id="cs_an_micro_grid" style="position: absolute; top: 613px; left: 110px; right: 70px; display: grid; grid-template-columns: 1fr 1fr; row-gap: 30px;">
            <!-- JS Injects Here -->
        </div>

        <!-- Relational Section Title -->
        <div class="w-[1080px] left-0 top-[970px] absolute text-center text-white text-3xl font-bold font-['Montserrat'] leading-5 tracking-wider">Patterns and Connections</div>

        <!-- Dynamic Relations -->
        <div id="cs_an_relations" style="position: absolute; top: 1030px; left: 87px; right: 87px; display: flex; flex-direction: column; gap: 24px;">
            <!-- JS Injects Here -->
        </div>

        <!-- Fixed Footer -->
        <div class="w-[952px] left-[64px] top-[1169px] absolute text-center text-white/60 text-xl font-medium font-['Montserrat'] tracking-wider">18+ only. For info/educational use. Not affiliated with PCSO; Lottong Pinoy does not facilitate betting. Always verify results via official PCSO channels.</div>
        <div class="w-[1080px] h-11 left-0 top-[1240px] absolute text-center text-white text-3xl font-bold font-['Montserrat']">lottong-pinoy.com</div>
        
    </div>
</div>
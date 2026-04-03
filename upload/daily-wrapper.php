<!-- DAILY RESULT WRAPPER (Dynamic Flow Layout) -->
<div id="cs_daily_wrapper" style="position: fixed; left: -9999px; top: 0; pointer-events: none; opacity: 0; z-index: -9999;">
    <div id="cs_daily_target" style="width: 1080px; height: 1350px; position: relative; background: #111E44; overflow: hidden; font-family: 'Montserrat', sans-serif;">
        
        <!-- LOGO & QR -->
        <img src="img/icon-192x192.png" style="width: 136px; height: 136px; left: 64px; top: 64px; position: absolute; border-radius: 10px;" crossorigin="anonymous">
        <img src="img/qrcode.png" style="width: 136px; height: 136px; left: 880px; top: 64px; position: absolute; border-radius: 10px;" crossorigin="anonymous">

        <!-- HEADER -->
        <div style="width: 682px; left: 199px; top: 80px; position: absolute; text-align: center">
            <span style="color: white; font-size: 68px; font-weight: 800;">Lottong</span>
            <span style="color: #3B82F6; font-size: 68px; font-weight: 800;"> Pinoy</span>
        </div>
        <div style="width: 672px; left: 209px; top: 181px; position: absolute; text-align: center; color: rgba(255, 255, 255, 0.50); font-size: 25px; font-weight: 700; letter-spacing: 3.25px;">LOTTO DRAW RESULTS</div>
        <div id="cs_daily_timestamp" style="width: 1080px; left: 0px; top: 233px; position: absolute; text-align: center; color: white; font-size: 28px; font-weight: 700; letter-spacing: 2.80px;">DATE</div>

        <!-- BODY WRAPPER (Starts at 294px, flows downwards) -->
        <div style="position: absolute; top: 294px; width: 100%;">
            
            <!-- MAJOR GAMES SECTION -->
            <div style="width: 100%; text-align: center; color: #B3D0FF; font-size: 28px; font-weight: 700; letter-spacing: 2.80px;">MAJOR GAMES</div>
            <div id="cs_daily_major_container" style="width: 952px; margin: 20px auto 0 auto;"></div>

            <!-- DAILY DRAWS SECTION (Margin-top creates the gap) -->
            <div style="width: 100%; text-align: center; color: #B3D0FF; font-size: 28px; font-weight: 700; letter-spacing: 2.80px; margin-top: 40px;">DAILY DRAWS</div>
            
            <div id="cs_daily_draws_container" style="width: 952px; margin: 20px auto 0 auto; display: flex; justify-content: space-between;">
                
                <!-- 2D COLUMN -->
                <div style="width: 46%;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <span style="color: white; font-size: 30px; font-weight: 700; letter-spacing: 3px;">2D EZ2 Lotto</span>
                        <span style="color: #FACC15; font-size: 24px; font-weight: 700;">₱ 4,000.00</span>
                    </div>
                    <div id="cs_daily_2d_container"></div>
                </div>

                <!-- 3D COLUMN -->
                <div style="width: 46%;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <span style="color: white; font-size: 30px; font-weight: 700; letter-spacing: 3px;">3D Swertres</span>
                        <span style="color: #FACC15; font-size: 24px; font-weight: 700;">₱ 4,500.00</span>
                    </div>
                    <div id="cs_daily_3d_container"></div>
                </div>
            </div>
        </div>

        <!-- FOOTER (Anchored at Bottom) -->
        <div style="position: absolute; bottom: 0; width: 100%; padding-bottom: 60px;">
            <div style="width: 952px; margin: 0 auto; text-align: center; color: rgba(255, 255, 255, 0.60); font-size: 22px; font-weight: 500; letter-spacing: 1.32px; margin-bottom: 30px;">
                18+ only. For info/educational use. Not affiliated with PCSO; Lottong Pinoy does not facilitate betting. Always verify results via official PCSO channels.
            </div>
            <div style="width: 100%; text-align: center; color: white; font-size: 28px; font-weight: 700;">
                lottong-pinoy.com
            </div>
        </div>

    </div>
</div>
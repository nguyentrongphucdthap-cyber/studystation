// --- TEXT TOOLS ---
const textTools = {
    menu: document.getElementById('text-selection-menu'),
    actionMenu: document.getElementById('highlight-action-menu'),
    noteEditor: document.getElementById('note-editor'),
    noteInput: document.getElementById('note-input'),
    currentSelection: null,
    tempRange: null, 
    activeHighlightSpan: null,

    init() {
        document.addEventListener('mouseup', (e) => this.handleSelection(e));
        document.addEventListener('mousedown', (e) => {
            if (!this.menu.contains(e.target) && !this.actionMenu.contains(e.target) && !this.noteEditor.contains(e.target)) {
                this.hideMenu(); this.hideActionMenu();
            }
        });
    },
    handleSelection(e) {
        if (this.menu.contains(e.target) || this.actionMenu.contains(e.target)) return;
        const passageContainer = document.querySelector('.passage-content');
        if (!passageContainer) return;
        const selection = window.getSelection();
        if (selection.toString().trim().length > 0 && passageContainer.contains(selection.anchorNode)) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            this.currentSelection = range;
            this.showMenu(rect.left + rect.width / 2, rect.top - 10);
        } else if (!this.noteEditor.contains(e.target)) { this.hideMenu(); }
    },
    showMenu(x, y) { this.hideActionMenu(); this.menu.style.left = `${x}px`; this.menu.style.top = `${y - 50}px`; this.menu.classList.remove('hidden'); this.menu.classList.add('animate-pop'); },
    hideMenu() { this.menu.classList.add('hidden'); this.menu.classList.remove('animate-pop'); },
    showActionMenu(x, y, span) { this.hideMenu(); this.activeHighlightSpan = span; this.actionMenu.style.left = `${x}px`; this.actionMenu.style.top = `${y - 45}px`; this.actionMenu.classList.remove('hidden'); this.actionMenu.classList.add('animate-pop'); },
    hideActionMenu() { this.actionMenu.classList.add('hidden'); this.activeHighlightSpan = null; },
    highlight(color) {
        if (!this.currentSelection) return;
        const span = document.createElement('span');
        span.className = `hl-${color} cursor-pointer rounded-sm px-0.5 transition-colors hover:brightness-95 highlight-item border-b-2 border-transparent hover:border-black/10`;
        span.onclick = (e) => { e.stopPropagation(); const rect = span.getBoundingClientRect(); this.showActionMenu(rect.left + rect.width / 2, rect.top, span); };
        try { this.currentSelection.surroundContents(span); window.getSelection().removeAllRanges(); this.hideMenu(); } catch (e) { alert("Vui lòng chọn văn bản nằm trong cùng một đoạn."); }
    },
    deleteHighlight() {
        if(this.activeHighlightSpan) {
            const span = this.activeHighlightSpan;
            const parent = span.parentNode;
            while(span.firstChild) parent.insertBefore(span.firstChild, span);
            parent.removeChild(span);
            this.hideActionMenu();
        }
    },
    openNoteInput() {
        if (!this.currentSelection) return;
        this.tempRange = this.currentSelection; 
        const rect = this.tempRange.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        let leftPos = (rect.left + rect.width / 2) - 144;
        if (leftPos + 288 > viewportWidth) leftPos = viewportWidth - 300;
        if (leftPos < 10) leftPos = 10;
        this.noteEditor.style.left = `${leftPos}px`;
        this.noteEditor.style.top = `${rect.top + rect.height + 10}px`;
        this.noteEditor.classList.remove('hidden');
        this.noteInput.value = "";
        this.noteInput.focus();
        this.hideMenu();
    },
    closeNoteInput() { this.noteEditor.classList.add('hidden'); },
    applyNote() {
        const text = this.noteInput.value.trim();
        if (!text || !this.tempRange) { this.closeNoteInput(); return; }
        const originalText = this.tempRange.toString();
        const span = document.createElement('span');
        span.className = 'user-note hover:bg-blue-100 transition-colors';
        span.textContent = text;
        span.dataset.original = originalText; span.dataset.note = text; span.title = "Click để quản lý";
        span.onclick = (e) => { e.stopPropagation(); this.manageNote(span); };
        try { this.tempRange.deleteContents(); this.tempRange.insertNode(span); } catch (e) { alert("Lỗi khi chèn ghi chú."); }
        this.closeNoteInput();
        window.getSelection().removeAllRanges();
    },
    manageNote(span) {
        if(span.classList.contains('reverted')) {
             if(confirm("Hiển thị lại ghi chú của bạn?")) { span.textContent = span.dataset.note; span.classList.remove('reverted', 'line-through', 'opacity-70', 'decoration-slate-500'); span.classList.add('user-note'); }
        } else {
            const choice = prompt("Chọn thao tác:\n1. Hoàn tác (Hiện văn bản gốc)\n2. Xóa ghi chú vĩnh viễn", "1");
            if (choice === "1") { span.textContent = span.dataset.original; span.classList.add('reverted', 'line-through', 'opacity-70', 'decoration-slate-500'); span.classList.remove('user-note'); }
            else if (choice === "2") { const textNode = document.createTextNode(span.dataset.original); span.parentNode.replaceChild(textNode, span); }
        }
    }
};

// --- APP ---
const app = {
    data: null, currentSectionIndex: 0, answers: {}, timer: null, settingsOpen: false, questionToSectionMap: {}, autoAdvanceTimeout: null, isReviewMode: false, reviewFilter: 'all',
    activeMobileTab: 'passage', // 'passage' or 'question'

    examLists: {
        'thpt': [{ id: 'thpt_2024', title: "Đề thi THPT QG 2024 - Mã đề 101", duration: "60 phút", count: 50 }],
        'dgnl': [{ id: 'dgnl_hcm', title: "ĐGNL ĐHQG TP.HCM - Đợt 1", duration: "90 phút", count: 30 }],
        'quiz': [{ id: 'quiz_1', title: "Mini Test: Tenses", duration: "15 phút", count: 15 }],
        'topic_1': [
            { id: 'topic1_vocab', title: "Từ vựng: Life Stories", duration: "45 phút", count: 56 },
            { id: 'topic1_reading', title: "Đọc hiểu: Life Stories", duration: "45 phút", count: 20 },
            { id: 'topic1_gap', title: "Điền từ: Life Stories", duration: "45 phút", count: 24 }
        ]
    },

    // CONTENT DATA
    examContent: {
        'thpt_2024': { title: "Đề thi THPT QG 2024", time: 3600, sections: [{ title: "Demo", type: "multiple_choice", questions: [{id:1, text:"Demo Q1", options:["A. A","B. B"], ans:"A"}] }] },
        
        // --- TOPIC 1 VOCAB ---
        'topic1_vocab': {
            title: "Từ vựng Chủ đề 1: Life Stories",
            time: 2700,
            sections: [
                {
                    title: "Multiple Choice Questions",
                    type: "multiple_choice",
                    questions: [
                        {id:1, text:"Charles Dickens <b>transformed</b> his childhood hardships into novels.", options:["A. transformed","B. transported","C. translated","D. deviated"], ans:"A"},
                        {id:2, text:"Wangari Maathai became an international <b>emblem</b> for community-led reforestation.", options:["A. presentation","B. emblem","C. delegate","D. illustration"], ans:"B"},
                        {id:3, text:"The young doctor faced <u>perilous</u> conditions treating civilians.", options:["A. prosperous","B. lenient","C. perilous","D. lavish"], ans:"C"},
                        {id:4, text:"Frida Kahlo was <b>denied</b> entry to medical school due to health issues.", options:["A. given","B. obtained","C. sought","D. denied"], ans:"D"},
                        {id:5, text:"The charity staged a <i>charity</i> concert featuring global superstars.", options:["A. charitable","B. charity","C. charitably","D. uncharitable"], ans:"B"},
                        {id:6, text:"Mandela's negotiations ending decades of racial <b>segregation</b> in South Africa.", options:["A. integration","B. segregation","C. achievement","D. exploitation"], ans:"B"},
                        {id:7, text:"The diplomat gained a global <b>reputation</b> for patience.", options:["A. fame","B. notoriety","C. reputation","D. stimulation"], ans:"C"},
                        {id:8, text:"Progressive companies strive not to <b>differentiate</b> between employees.", options:["A. segregate","B. alienate","C. categorize","D. differentiate"], ans:"D"},
                        {id:9, text:"Bill Gates became one of the most <b>influential</b> individuals in technology.", options:["A. influential","B. disreputable","C. anonymous","D. patriotic"], ans:"A"},
                        {id:10, text:"Her memoir became an enduring <b>inspiration</b> for anyone.", options:["A. prosperity","B. inspiration","C. reputation","D. stimulation"], ans:"B"},
                        {id:11, text:"He demonstrated remarkable <b>initiative</b> by launching a literacy program.", options:["A. initiation","B. initiate","C. initiative","D. initial"], ans:"C"},
                        {id:12, text:"Local factory <b>managers</b> partnered with civic leaders.", options:["A. managers","B. trainers","C. employers","D. workers"], ans:"A"},
                        {id:13, text:"His project <b>earned</b> him a scholarship to MIT.", options:["A. earned","B. attained","C. resorted","D. applied"], ans:"A"},
                        {id:14, text:"Recurring illness could not <b>deter</b> her from touring refugee camps.", options:["A. deter","B. dissuade","C. warn","D. appoint"], ans:"A"},
                        {id:15, text:"Princess Diana encouraged her sons to cultivate every latent <b>potential</b>.", options:["A. capacity","B. requirement","C. potential","D. condition"], ans:"C"},
                        {id:16, text:"Meeting her childhood idol was a remarkable <b>stroke</b> of luck.", options:["A. piece","B. number","C. name","D. stroke"], ans:"D"},
                        {id:17, text:"Malala is <b>regarded</b> as a fearless advocate.", options:["A. regarded","B. depicted","C. admired","D. classified"], ans:"A"},
                        {id:18, text:"The researcher <b>specialized</b> in sustainable chemistry.", options:["A. qualified","B. specialized","C. engrossed","D. indulged"], ans:"B"},
                        {id:19, text:"Theresa May <b>secured</b> a scholarship place at Oxford.", options:["A. secured","B. permitted","C. won","D. constituted"], ans:"A"},
                        {id:20, text:"She has often been critical <b>of</b> journalists.", options:["A. about","B. for","C. in","D. of"], ans:"D"},
                        {id:21, text:"Malala Yousafzai selflessly <b>devoted</b> entire adult life.", options:["A. devoted","B. expanded","C. resorted","D. declined"], ans:"A"},
                        {id:22, text:"The young scientist delivered a captivating <b>lecture</b>.", options:["A. symbol","B. lecture","C. delegate","D. scenery"], ans:"B"},
                        {id:23, text:"Reminding communities never to <b>dismiss</b> people with disabilities.", options:["A. encourage","B. repair","C. prevent","D. dismiss"], ans:"D"},
                        {id:24, text:"To <b>raise</b> substantial relief funds.", options:["A. rise","B. raise","C. lift","D. climb"], ans:"B"},
                        {id:25, text:"Oprah Winfrey eventually <b>achieved</b> astonishing success.", options:["A. achieved","B. escaped","C. resigned","D. disregarded"], ans:"A"},
                        {id:26, text:"Dr Jane Goodall has been universally <b>praised</b> for her observations.", options:["A. praised","B. wasted","C. postponed","D. removed"], ans:"A"},
                        {id:27, text:"Founded a non-profit to <b>renovate</b> abandoned village classrooms.", options:["A. donate","B. renovate","C. decorate","D. irrigate"], ans:"B"},
                        {id:28, text:"The young engineer no longer <b>doubted</b> his capacity.", options:["A. obeyed","B. delayed","C. doubted","D. gained"], ans:"C"},
                        {id:29, text:"Attracted worldwide <b>attention</b> to the escalating crisis.", options:["A. attention","B. invention","C. detention","D. intention"], ans:"A"},
                        {id:30, text:"Criticised as a <b>conservative</b> thinker.", options:["A. innovative","B. repetitive","C. conservative","D. tentative"], ans:"C"},
                        {id:31, text:"Humanitarian work has been <b>emulated</b> by countless charities.", options:["A. evacuated","B. emulated","C. emasculated","D. elaborated"], ans:"B"},
                        {id:32, text:"The author crafts a <b>compelling</b> narrative.", options:["A. repelling","B. compelling","C. dispelling","D. misspelling"], ans:"B"},
                        {id:33, text:"Her speech served as a <b>catalyst</b> for unprecedented engagement.", options:["A. ballast","B. catalyst","C. contrast","D. forecast"], ans:"B"},
                        {id:34, text:"The foundation's <b>philanthropic</b> donations.", options:["A. bureaucratic","B. problematic","C. philanthropic","D. dogmatic"], ans:"C"},
                        {id:35, text:"His achievements <b>epitomize</b> the possibilities.", options:["A. plagiarize","B. magnetize","C. epitomize","D. exorcize"], ans:"C"},
                        {id:36, text:"The journalist wrote a <b>nuanced</b> profile.", options:["A. outdated","B. diluted","C. nuanced","D. deflated"], ans:"C"},
                        {id:37, text:"She remained <b>unwavering</b> in her pursuit.", options:["A. unrelenting","B. unfurling","C. unwavering","D. unraveling"], ans:"C"},
                        {id:38, text:"Their research <b>transcended</b> traditional views.", options:["A. suspended","B. commended","C. descended","D. transcended"], ans:"D"},
                        {id:39, text:"The memoir offers a <b>reflective</b> look.", options:["A. coercive","B. permissive","C. abortive","D. reflective"], ans:"D"},
                        {id:40, text:"His optimism became a <b>beacon</b> of hope.", options:["A. canyon","B. coupon","C. lexicon","D. beacon"], ans:"D"}
                    ]
                }
            ]
        },
        
        // --- TOPIC 1 READING ---
        'topic1_reading': {
            title: "Đọc hiểu Chủ đề 1: Life Stories",
            time: 2700,
            sections: [
                {
                    title: "Nguyễn Tất Thành's Journey",
                    type: "reading",
                    content: `<h3 class="font-bold mb-3 text-lg">Nguyen Tat Thanh's Historic Odyssey</h3><p>Exactly 110 years ago, the young <b>Nguyen Tat Thanh</b>, adopting the alias <i>Van Ba</i>, embarked on his historic odyssey from <b>Nha Rong Wharf</b> in Saigon. He deliberately chose this southern gateway, a hub for shipping lines like the France-Indochina route, as his point of departure. [I] His burning ambition: to seek a path for liberating his colonized homeland from French rule. This 30-year journey would transform him into <b>Ho Chi Minh</b> and ultimately forge the way for Vietnam's independence. A pivotal moment came with the 1919 Paris Peace Conference. Seizing this global stage, Nguyen Tat Thanh delivered the "<i>Petition from the People of An Nam.</i>" [II] This manifesto, a <u>watershed</u> in Vietnam's modern political history, demanded international recognition of the Vietnamese people's fundamental rights. While relatively moderate, its profound impact resonated globally. [III] Nguyen Ai Quoc's ideological clarity crystallized in mid-1920 upon reading Lenin's "Theses on the National and Colonial Question". He described being overcome with "emotion, enthusiasm, clear-sightedness and confidence," realizing Leninism was the essential path to liberation. Archives in Moscow detail activities focused on deep theoretical study. [IV] As Professor Vladimir Kolotov emphasizes, this period was a crucial strategic pivot.</p>`,
                    questions: [
                        {id:1, text:"Why did Nguyen Tat Thanh choose <b>Nha Rong Wharf</b>?", options:["A. It linked Saigon to established international shipping routes","B. It offered clandestine passage","C. It lay beyond French reach","D. It was recommended by revolutionaries"], ans:"A"},
                        {id:2, text:"Which statement best summarises paragraph 1?", options:["A. It reflected his uncertainty","B. The line carried activists routinely","C. His departure launched a quest forging independence","D. Independence was secured swiftly"], ans:"C"},
                        {id:3, text:"Which effect of the 1919 Petition is <b>NOT</b> mentioned?", options:["A. Established his name","B. Demanded fundamental rights","C. Triggered immediate French withdrawal","D. Voiced Vietnam's plight"], ans:"C"},
                        {id:4, text:"The word '<u>watershed</u>' is closest in meaning to:", options:["A. turning-point","B. obstacle","C. concession","D. forecast"], ans:"A"},
                        {id:5, text:"Where would 'His search for effective resistance led him to the French Socialist Party...' fit?", options:["A. [II]","B. [IV]","C. [I]","D. [III]"], ans:"D"},
                        {id:6, text:"Paraphrase the underlined sentence in para 3 (Leninism)?", options:["A. He remained doubtful","B. Lenin's ideas stirred feelings and gave certainty","C. He remained unconvinced","D. Sparked enthusiasm for diplomatic recognition"], ans:"B"},
                        {id:7, text:"Why cite Moscow archives?", options:["A. Substantiate study/planning","B. Question his adoption of Marxism","C. Show limited Soviet support","D. Argue preference for Moscow"], ans:"A"},
                        {id:8, text:"Opposite of '<b>embodying</b>'?", options:["A. personifying","B. symbolizing","C. exemplifying","D. contradicting"], ans:"D"},
                        {id:9, text:"Inference from passage?", options:["A. Moderate petitions alone could not dislodge rule","B. Tours supplied financial resources","C. Time in Soviet was for diplomacy","D. Without shipping lines he would abandon plans"], ans:"A"},
                        {id:10, text:"Summary of passage?", options:["A. Petitions were sufficient","B. French networks shaped ideology","C. Independence owed little to intl influence","D. Evolution marked by strategic departures and convictions"], ans:"D"}
                    ]
                },
                {
                    title: "Yvonne Hughes",
                    type: "reading",
                    content: `<h3 class="font-bold mb-3 text-lg">Yvonne Hughes & Cystic Fibrosis</h3><p><b>Yvonne Hughes</b> was 19, attending the funeral of a friend with cystic fibrosis (CF), when she realized: "Oh shit, I'm going to die of this." She had always known she had CF but never understood it as terminal until that day. For most of her childhood, Hughes didn't regard herself as struggling for survival. CF was considered "a childhood disease". After that funeral she became <i>reckless</i>: "festivals, partying, travelling...". In her 30s her lung function fell to 36%. She grieved, then declared: "I'd rather have a full and short life than a long and unhappy one." In 2018, aged 45, she was judged too ill for transplant. Then, in 2020, the UK granted access to <b>Kaftrio</b>. "It was a miracle." Her lung function doubled. [I] Energised, Hughes enrolled on an evening comedy course. [II] Her show turns struggle into laughter. [III] Each punchline is proof that statistics are not certainties. [IV]</p>`,
                    questions: [
                        {id:11, text:"What made Hughes realize CF could claim her life?", options:["A. Meeting palliative team","B. Hearing statistics","C. Clinical tests","D. Witnessing a peer's burial"], ans:"D"},
                        {id:12, text:"'this thing I had' refers to?", options:["A. cystic fibrosis","B. the funeral","C. depression","D. behavior"], ans:"A"},
                        {id:13, text:"<b>NOT</b> mentioned as reckless activity?", options:["A. festivals","B. competitive cycling","C. travelling","D. partying"], ans:"B"},
                        {id:14, text:"Paraphrase 'rather have a full and short life'?", options:["A. Accepted dull life","B. Preferred vibrant short life to cautious long one","C. Longevity mattered more","D. Ending life early"], ans:"B"},
                        {id:15, text:"Summary of paragraph 2?", options:["A. Hospital support","B. Medical isolation","C. Funeral spurred risk-taking; chose vivid life","D. Withdrew from social life"], ans:"C"},
                        {id:16, text:"'<u>hovered</u>' closest to?", options:["A. remained static at","B. surged beyond","C. dipped below","D. fluctuated around"], ans:"A"},
                        {id:17, text:"Mention of <b>Kaftrio</b> shows?", options:["A. transplant unnecessary","B. team overestimated","C. weight gain","D. breakthrough reversed decline"], ans:"D"},
                        {id:18, text:"Where fits 'The illness... is now a backdrop'?", options:["A. [II]","B. [IV]","C. [I]","D. [III]"], ans:"B"},
                        {id:19, text:"Inference?", options:["A. No longer assumes expectancy tables define her","B. Statistically certain to reach average lifespan","C. Chose least demanding art","D. Avoided relationships"], ans:"A"},
                        {id:20, text:"Summary of passage?", options:["A. Funerals learn prognosis","B. Journey from despair to medical breakthrough & hope","C. Resigned to short life","D. Drugs rarely alter trajectory"], ans:"B"}
                    ]
                }
            ]
        },

        // --- TOPIC 1 GAP FILL ---
        'topic1_gap': {
            title: "Điền từ Chủ đề 1: Life Stories",
            time: 2700,
            sections: [
                {
                    title: "Marie Curie",
                    type: "gap_fill",
                    content: `<h3 class="font-bold mb-3 text-lg">Marie Curie</h3><p><b>Marie Curie</b>, born in Warsaw in 1867, overcame institutional discrimination against women to <span class="bg-blue-100 dark:bg-blue-900 px-2 rounded font-bold text-blue-600 dark:text-blue-300 mx-1">(1)</span> her dream. Winning a scholarship, she studied physics at the <i>Sorbonne</i> and soon became a <span class="bg-blue-100 dark:bg-blue-900 px-2 rounded font-bold text-blue-600 dark:text-blue-300 mx-1">(2)</span> in the new field of radioactivity. Working long hours in an unheated shed, she isolated the elements polonium and radium-an achievement <span class="bg-blue-100 dark:bg-blue-900 px-2 rounded font-bold text-blue-600 dark:text-blue-300 mx-1">(3)</span> as a scientific breakthrough. The work exposed her <span class="bg-blue-100 dark:bg-blue-900 px-2 rounded font-bold text-blue-600 dark:text-blue-300 mx-1">(4)</span> toxic levels of radiation, yet her tenacity <span class="bg-blue-100 dark:bg-blue-900 px-2 rounded font-bold text-blue-600 dark:text-blue-300 mx-1">(5)</span> her onward. Her <span class="bg-blue-100 dark:bg-blue-900 px-2 rounded font-bold text-blue-600 dark:text-blue-300 mx-1">(6)</span> reminds us that determined curiosity can rewrite the boundaries of knowledge.</p>`,
                    questions: [
                        {id:1, text:"Question 1:", options:["A. chase","B. run after","C. pursue","D. track"], ans:"C"},
                        {id:2, text:"Question 2:", options:["A. housekeeper","B. pioneer","C. discoverer","D. breadwinner"], ans:"B"},
                        {id:3, text:"Question 3:", options:["A. hailed","B. praised","C. talked","D. shouted"], ans:"A"},
                        {id:4, text:"Question 4:", options:["A. for","B. with","C. of","D. to"], ans:"D"},
                        {id:5, text:"Question 5:", options:["A. drove","B. pushed","C. led","D. ran"], ans:"A"},
                        {id:6, text:"Question 6:", options:["A. endurable","B. durable","C. enduring","D. legacy"], ans:"D"}
                    ]
                },
                {
                    title: "Nguyễn Thị Bình",
                    type: "gap_fill",
                    content: `<h3 class="font-bold mb-3 text-lg">Nguyễn Thị Bình</h3><p><b>Nguyễn Thị Bình</b>, born in Sa Đéc in 1927, <span class="bg-blue-100 dark:bg-blue-900 px-2 rounded font-bold text-blue-600 dark:text-blue-300 mx-1">(7)</span> herself into politics as a fiery student militant. Fluent in French and English, she soon stood at the forefront of the National Liberation Front, serving as its chief <span class="bg-blue-100 dark:bg-blue-900 px-2 rounded font-bold text-blue-600 dark:text-blue-300 mx-1">(8)</span> at the Paris Peace Talks. Her calm yet <span class="bg-blue-100 dark:bg-blue-900 px-2 rounded font-bold text-blue-600 dark:text-blue-300 mx-1">(9)</span> stance earned respect from diplomats worldwide. After reunification, Madame Bình left no <span class="bg-blue-100 dark:bg-blue-900 px-2 rounded font-bold text-blue-600 dark:text-blue-300 mx-1">(10)</span> unturned in rebuilding the nation's education system. She championed children's rights, weaving social welfare <span class="bg-blue-100 dark:bg-blue-900 px-2 rounded font-bold text-blue-600 dark:text-blue-300 mx-1">(11)</span> Vietnam's economic framework. Her commitment still <span class="bg-blue-100 dark:bg-blue-900 px-2 rounded font-bold text-blue-600 dark:text-blue-300 mx-1">(12)</span> a fire under younger activists.</p>`,
                    questions: [
                        {id:7, text:"Question 7:", options:["A. left","B. dropped","C. threw","D. flung"], ans:"C"},
                        {id:8, text:"Question 8 (negotiator):", options:["A. advocate","B. opposer","C. executive","D. discriminator"], ans:"A"},
                        {id:9, text:"Question 9:", options:["A. unyielding","B. ambiguous","C. equivocal","D. conciliatory"], ans:"A"},
                        {id:10, text:"Question 10:", options:["A. rock","B. stone","C. brick","D. gem"], ans:"B"},
                        {id:11, text:"Question 11:", options:["A. on","B. into","C. at","D. in"], ans:"B"},
                        {id:12, text:"Question 12:", options:["A. burns","B. sets","C. lights","D. kindles"], ans:"C"}
                    ]
                },
                {
                    title: "Elon Musk",
                    type: "gap_fill",
                    content: `<h3 class="font-bold mb-3 text-lg">Elon Musk</h3><p><b>Elon Musk</b>, born in Pretoria in 1971, has emerged as one of the most influential technology entrepreneurs... Musk redirected the proceeds into high-risk sectors that conventional investors typically avoid. Foremost among these ventures is <b>SpaceX</b>... Equally transformative is <b>Tesla</b>, the company that has elevated battery-electric vehicles... setting a new benchmark for sustainable mobility... visionary leadership can collectively catalyze structural change.</p>`,
                    questions: [
                        {id:13, text:"'<b>emerged</b>' closest to:", options:["A. surfaced","B. receded","C. subsided","D. vanished"], ans:"A"},
                        {id:14, text:"'<b>influential</b>' closest to:", options:["A. negligible","B. dominant","C. inadequate","D. consequential"], ans:"D"},
                        {id:15, text:"'<b>conventional</b>' closest to:", options:["A. radical","B. impressive","C. traditional","D. innovative"], ans:"C"},
                        {id:16, text:"'<b>avoid</b>' closest to:", options:["A. steer clear of","B. stick close to","C. zero in on","D. gravitate"], ans:"A"},
                        {id:17, text:"'<b>lowered</b>' opposite to:", options:["A. curtailed","B. removed","C. diminished","D. raised"], ans:"D"},
                        {id:18, text:"'<b>visionary</b>' opposite to:", options:["A. prescient","B. myopic","C. forward-looking","D. idealistic"], ans:"B"}
                    ]
                },
                {
                    title: "Angela Merkel",
                    type: "gap_fill",
                    content: `<h3 class="font-bold mb-3 text-lg">Angela Merkel</h3><p><b>Angela Merkel</b> became Germany's chancellor on 22 November 2005. Born and schooled in East Germany, <span class="bg-blue-100 dark:bg-blue-900 px-2 rounded font-bold text-blue-600 dark:text-blue-300 mx-1">(19)</span>. That event pulled her into politics... Helmut Kohl, who guided reunification, gave her a series of cabinet posts, <span class="bg-blue-100 dark:bg-blue-900 px-2 rounded font-bold text-blue-600 dark:text-blue-300 mx-1">(20)</span>. When the Christian Democratic Union lost power in 1998, Merkel, <span class="bg-blue-100 dark:bg-blue-900 px-2 rounded font-bold text-blue-600 dark:text-blue-300 mx-1">(21)</span>, guided the party through its rough patch... Ties with Washington, <span class="bg-blue-100 dark:bg-blue-900 px-2 rounded font-bold text-blue-600 dark:text-blue-300 mx-1">(22)</span>, cooled when Donald Trump questioned NATO... <span class="bg-blue-100 dark:bg-blue-900 px-2 rounded font-bold text-blue-600 dark:text-blue-300 mx-1">(23)</span> she left office-term finished, mark firmly set.</p>`,
                    questions: [
                        {id:19, text:"Question 19:", options:["A. she earned a PhD...","B. Germany became...","C. the place where she earned a PhD...","D. she earned her doctorate..."], ans:"C"},
                        {id:20, text:"Question 20:", options:["A. his backing sharpened her public image","B. his backing sharpening...","C. which sharpens...","D. sharpened her public image with his backing"], ans:"D"},
                        {id:21, text:"Question 21:", options:["A. that was first chosen...","B. first choosing...","C. first chosen as Secretary-General...","D. was first chosen..."], ans:"C"},
                        {id:22, text:"Question 22:", options:["A. is smooth...","B. which smooths...","C. smooth under George W. Bush...","D. smoothing..."], ans:"C"},
                        {id:23, text:"Question 23:", options:["A. she gave up...","B. after she giving up...","C. given up...","D. after giving up the CDU post..."], ans:"D"}
                    ]
                }
            ]
        }
    },

    init() { this.loadSettings(); textTools.init(); this.goHome(); this.setupOutsideClick(); },
    setupOutsideClick() { document.addEventListener('click', (e) => { const panel = document.getElementById('settings-panel'); const btn = document.getElementById('btn-settings'); if (this.settingsOpen && !panel.contains(e.target) && !btn.contains(e.target)) this.toggleSettings(e); }); },
    loadSettings() { const fs = localStorage.getItem('fontSize') || 16; this.setFontSize(fs); document.querySelector('input[type="range"]').value = fs; if(localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark'); },
    toggleSettings(e) { if(e) e.stopPropagation(); this.settingsOpen = !this.settingsOpen; document.getElementById('settings-panel').classList.toggle('hidden', !this.settingsOpen); if(this.settingsOpen) document.getElementById('settings-panel').classList.add('animate-pop'); },
    toggleDarkMode() { document.documentElement.classList.toggle('dark'); localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light'); },
    setFontSize(val) { document.documentElement.style.setProperty('--content-size', `${val}px`); document.getElementById('font-size-val').innerText = `${val}px`; localStorage.setItem('fontSize', val); },
    setLineHeight(val) { document.documentElement.style.setProperty('--line-height', val); document.getElementById('line-height-val').innerText = val; },
    goHome() { clearInterval(this.timer); this.isReviewMode = false; document.body.classList.remove('review-mode'); this.hideExamUI(); const tpl = document.getElementById('tpl-home'); document.getElementById('app-container').innerHTML = tpl.innerHTML; },
    hideExamUI() { document.getElementById('exam-timer').classList.add('hidden'); document.getElementById('section-progress').classList.add('hidden'); document.getElementById('btn-submit').classList.add('hidden'); document.getElementById('bottom-nav').classList.add('hidden'); document.getElementById('review-filters').classList.add('hidden'); document.getElementById('btn-close-review').classList.add('hidden'); },
    showExamList(type) {
        const exams = this.examLists[type] || [];
        let html = `<div class="max-w-4xl mx-auto px-4 py-6 lg:py-10 animate-fade-in"><button onclick="app.goHome()" class="flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-6 font-medium transition-colors"><i class="ph-bold ph-arrow-left"></i> Quay lại</button><h2 class="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white mb-6">Chọn đề thi</h2><div class="space-y-4">`;
        if (exams.length === 0) html += `<div class="text-center text-slate-500 py-10">Chưa có đề thi nào.</div>`;
        else exams.forEach(ex => { html += `<div onclick="app.startExam('${ex.id}')" class="bg-white dark:bg-slate-800 p-5 lg:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 cursor-pointer shadow-sm hover:shadow-md transition-all group"><div class="flex justify-between items-center"><div><h3 class="font-bold text-base lg:text-lg text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">${ex.title}</h3><div class="flex items-center gap-3 mt-2 text-xs lg:text-sm text-slate-500 dark:text-slate-400"><span class="flex items-center gap-1"><i class="ph-fill ph-clock"></i> ${ex.duration}</span><span class="flex items-center gap-1"><i class="ph-fill ph-list-numbers"></i> ${ex.count} câu</span></div></div><div class="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all"><i class="ph-bold ph-caret-right"></i></div></div></div>`; });
        html += `</div></div>`; document.getElementById('app-container').innerHTML = html;
    },
    startExam(id) {
        this.data = this.examContent[id] || this.examContent['thpt_2024'];
        this.answers = {}; this.currentSectionIndex = 0; this.isReviewMode = false; document.body.classList.remove('review-mode');
        this.questionToSectionMap = {}; let totalQs = 0;
        this.data.sections.forEach((sec, idx) => { sec.questions.forEach(q => { this.questionToSectionMap[q.id] = idx; totalQs++; }); });
        document.getElementById('section-progress').classList.remove('hidden'); document.getElementById('section-progress').classList.add('flex');
        document.getElementById('exam-timer').classList.remove('hidden'); document.getElementById('btn-submit').classList.remove('hidden');
        document.getElementById('bottom-nav').classList.remove('hidden'); document.getElementById('bottom-nav').classList.add('flex');
        document.getElementById('total-count').innerText = totalQs;
        this.startTimer(this.data.time); this.renderSection(); this.renderGlobalBottomNav();
    },
    startTimer(seconds) {
        const el = document.getElementById('timer-display'); let rem = seconds;
        this.timer = setInterval(() => { rem--; const m = Math.floor(rem/60).toString().padStart(2,'0'); const s = (rem%60).toString().padStart(2,'0'); el.innerText = `${m}:${s}`; if(rem<=0) this.openSubmitModal(); }, 1000);
    },
    
    // --- NEW: Toggle Mobile Split View ---
    toggleMobileSplitTab(tab) {
        this.activeMobileTab = tab;
        const left = document.getElementById('left-pane');
        const right = document.getElementById('right-pane');
        const btnPassage = document.getElementById('tab-btn-passage');
        const btnQuestion = document.getElementById('tab-btn-question');
        
        if (tab === 'passage') {
            left.classList.remove('hidden'); left.classList.add('block');
            right.classList.add('hidden'); right.classList.remove('block');
            btnPassage.classList.add('mobile-tab-active');
            btnQuestion.classList.remove('mobile-tab-active');
        } else {
            left.classList.add('hidden'); left.classList.remove('block');
            right.classList.remove('hidden'); right.classList.add('block');
            btnPassage.classList.remove('mobile-tab-active');
            btnQuestion.classList.add('mobile-tab-active');
        }
    },

    renderSection() {
        const section = this.data.sections[this.currentSectionIndex];
        document.getElementById('section-title-display').innerText = `Phần ${this.currentSectionIndex + 1}: ${section.title}`;
        let html = '';
        
        if (section.type === 'reading' || section.type === 'gap_fill') {
            // Mobile Tabs HTML
            const mobileTabs = `
                <div class="flex lg:hidden sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 w-full">
                    <button id="tab-btn-passage" onclick="app.toggleMobileSplitTab('passage')" class="flex-1 py-3 text-sm font-medium text-slate-500 dark:text-slate-400 mobile-tab-active transition-all">Đoạn văn</button>
                    <button id="tab-btn-question" onclick="app.toggleMobileSplitTab('question')" class="flex-1 py-3 text-sm font-medium text-slate-500 dark:text-slate-400 transition-all">Câu hỏi (${section.questions.length})</button>
                </div>
            `;

            // Main Container with responsive classes
            // Mobile: height - header - nav - tabs. Desktop: flex row.
            html = `
                <div class="h-full flex flex-col animate-fade-in" id="split-container">
                    ${mobileTabs}
                    <div class="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                        <!-- Left Pane -->
                        <div class="w-full lg:w-1/2 h-full overflow-y-auto custom-scroll bg-white dark:bg-slate-800 p-4 lg:p-8 passage-content relative shadow-inner block" id="left-pane">
                            <div class="dynamic-text text-justify prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 pb-20 lg:pb-0">
                                ${section.content}
                            </div>
                            <div class="mt-8 text-center text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700 lg:hidden">
                                (Chuyển tab để xem câu hỏi)
                            </div>
                        </div>
                        
                        <!-- Resizer (Desktop Only) -->
                        <div class="resizer hidden lg:flex" id="drag-handle"></div>
                        
                        <!-- Right Pane -->
                        <div class="w-full lg:flex-1 h-full overflow-y-auto custom-scroll bg-slate-50 dark:bg-slate-900 p-4 lg:p-8 pb-24 hidden lg:block" id="right-pane">
                            <div class="max-w-2xl mx-auto space-y-4 lg:space-y-6">
                                ${section.questions.map(q => this.renderQuestionCard(q)).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('app-container').innerHTML = html;
            
            // Reset to default tab state on render
            this.activeMobileTab = 'passage';
            this.toggleMobileSplitTab('passage'); // Ensure styling matches state
            
            this.initResizer();
        } else {
            html = `<div class="h-full overflow-y-auto custom-scroll bg-slate-50 dark:bg-slate-900 p-4 lg:p-8 pb-24 animate-fade-in"><div class="max-w-3xl mx-auto space-y-4 lg:space-y-6">${section.questions.map(q => this.renderQuestionCard(q)).join('')}</div></div>`;
            document.getElementById('app-container').innerHTML = html;
        }
    },
    initResizer() {
        const resizer = document.getElementById('drag-handle'); const leftPane = document.getElementById('left-pane'); const container = document.getElementById('split-container');
        if (!resizer || !leftPane || !container) return;
        let isResizing = false;
        resizer.addEventListener('mousedown', () => { isResizing = true; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; });
        document.addEventListener('mousemove', (e) => { if (!isResizing) return; const containerRect = container.getBoundingClientRect(); const newWidth = e.clientX - containerRect.left; if (newWidth > containerRect.width * 0.2 && newWidth < containerRect.width * 0.8) leftPane.style.width = `${(newWidth / containerRect.width) * 100}%`; });
        document.addEventListener('mouseup', () => { isResizing = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; });
    },
    renderQuestionCard(q) {
        const saved = this.answers[q.id];
        let cardClass = ""; let statusIcon = ""; let explanation = ""; let shouldHide = false;
        if (this.isReviewMode) {
            const isCorrect = saved === q.ans;
            if (this.reviewFilter === 'correct' && !isCorrect) shouldHide = true;
            if (this.reviewFilter === 'incorrect' && isCorrect) shouldHide = true;
            if (shouldHide) return ''; 
            if (isCorrect) { cardClass = "border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/10"; statusIcon = `<i class="ph-fill ph-check-circle text-green-500 text-lg lg:text-xl"></i>`; }
            else { cardClass = "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/10"; statusIcon = `<i class="ph-fill ph-x-circle text-red-500 text-lg lg:text-xl"></i>`; }
            explanation = `<div class="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs lg:text-sm"><span class="font-bold text-slate-700 dark:text-slate-300">Đáp án:</span> <span class="text-green-600 font-bold">${q.ans}</span></div>`;
        }
        return `<div class="bg-white dark:bg-slate-800 p-4 lg:p-6 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-200 dark:border-slate-700 dynamic-text group/card ${cardClass}" id="q-${q.id}"><div class="flex justify-between items-start mb-3 lg:mb-4"><div class="flex gap-3 lg:gap-4"><span class="flex-shrink-0 w-7 h-7 lg:w-8 lg:h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-xs lg:text-sm shadow-sm">${q.id}</span><div class="font-medium pt-1 text-slate-800 dark:text-slate-200 leading-relaxed">${q.text}</div></div>${statusIcon}</div><div class="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3 pl-0 lg:pl-12">${q.options.map(opt => { const val = opt.charAt(0); const isChecked = saved === val; let optionClass = "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700"; let circleClass = "border-slate-300 dark:border-slate-500 text-slate-500 dark:text-slate-400"; if (this.isReviewMode) { if (val === q.ans) { optionClass = "correct-option border-green-500"; circleClass = "bg-green-600 border-green-600 text-white"; } else if (isChecked && val !== q.ans) { optionClass = "wrong-option border-red-500"; circleClass = "bg-red-500 border-red-500 text-white"; } else { optionClass = "opacity-50"; } } const checkedAttr = isChecked ? 'checked' : ''; const disabledAttr = this.isReviewMode ? 'disabled' : ''; return `<label class="cursor-pointer group relative ${this.isReviewMode ? 'cursor-default' : ''}"><input type="radio" name="q${q.id}" value="${val}" ${checkedAttr} ${disabledAttr} class="peer sr-only option-radio" onchange="app.saveAnswer(${q.id}, '${val}')"><div class="p-3 lg:p-3.5 rounded-xl border transition-all duration-200 flex items-center gap-3 shadow-sm ${optionClass}"><span class="option-circle w-5 h-5 lg:w-6 lg:h-6 rounded-full border-2 flex items-center justify-center text-[9px] lg:text-[10px] font-bold transition-all duration-200 ${circleClass}">${val}</span><span class="text-xs lg:text-sm font-medium text-slate-700 dark:text-slate-300">${opt.substring(3)}</span></div></label>`; }).join('')}</div>${explanation}</div>`;
    },
    renderGlobalBottomNav() {
        const container = document.getElementById('question-bubbles'); let html = '';
        this.data.sections.forEach(section => { section.questions.forEach(q => { const isDone = this.answers[q.id]; const isCorrect = isDone === q.ans; let bubbleClass = "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-500"; if (this.isReviewMode) { if (isCorrect) bubbleClass = "bg-green-500 border-green-500 text-white"; else if (isDone) bubbleClass = "bg-red-500 border-red-500 text-white"; else bubbleClass = "bg-slate-300 dark:bg-slate-700 border-transparent text-slate-500"; } else { if (isDone) bubbleClass = "bg-blue-600 text-white border-blue-600 scale-105 shadow-md"; } html += `<button id="bubble-${q.id}" onclick="app.jumpToQuestion(${q.id})" class="flex-shrink-0 w-8 h-8 lg:w-9 lg:h-9 rounded-full border ${bubbleClass} text-[10px] lg:text-xs font-bold transition-all duration-200 shadow-sm hover:shadow-md active:scale-95">${q.id}</button>`; }); });
        container.innerHTML = html;
    },
    saveAnswer(qid, val) { if(this.isReviewMode) return; this.answers[qid] = val; this.renderGlobalBottomNav(); document.getElementById('completed-count').innerText = Object.keys(this.answers).length; this.checkAutoAdvance(); },
    checkAutoAdvance() { if (this.autoAdvanceTimeout) clearTimeout(this.autoAdvanceTimeout); const currentSection = this.data.sections[this.currentSectionIndex]; const allAnswered = currentSection.questions.every(q => this.answers[q.id]); if (allAnswered && this.currentSectionIndex < this.data.sections.length - 1) { this.autoAdvanceTimeout = setTimeout(() => { this.nextSection(); }, 2000); } },
    nextSection() { if (this.currentSectionIndex < this.data.sections.length - 1) { this.currentSectionIndex++; this.renderSection(); } },
    prevSection() { if (this.currentSectionIndex > 0) { this.currentSectionIndex--; this.renderSection(); } },
    jumpToQuestion(qid) { 
        const targetSectionIdx = this.questionToSectionMap[qid]; 
        
        // Logic: If on mobile & in split view, switch to question tab
        if (window.innerWidth < 1024 && (this.data.sections[targetSectionIdx].type === 'reading' || this.data.sections[targetSectionIdx].type === 'gap_fill')) {
            this.activeMobileTab = 'question';
        }

        if (targetSectionIdx !== this.currentSectionIndex) { 
            this.currentSectionIndex = targetSectionIdx; 
            this.renderSection(); 
            // Apply tab state if needed after render
            if (this.activeMobileTab === 'question') this.toggleMobileSplitTab('question');
            setTimeout(() => this.scrollToQ(qid), 100); 
        } else { 
            if (this.activeMobileTab === 'question') this.toggleMobileSplitTab('question');
            this.scrollToQ(qid); 
        } 
    },
    scrollToQ(qid) { const el = document.getElementById(`q-${qid}`); if(el) { el.scrollIntoView({behavior:'smooth', block:'center'}); el.classList.add('ring-2', 'ring-blue-400'); setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400'), 2000); } },
    openSubmitModal() { document.getElementById('submit-modal-overlay').classList.remove('hidden'); document.getElementById('modal-answered-count').innerText = Object.keys(this.answers).length; let total = 0; this.data.sections.forEach(s => total += s.questions.length); document.getElementById('modal-total-count').innerText = total; },
    closeSubmitModal() { document.getElementById('submit-modal-overlay').classList.add('hidden'); },
    confirmSubmit() { this.closeSubmitModal(); clearInterval(this.timer); let correctCount = 0; let totalCount = 0; this.data.sections.forEach(s => { s.questions.forEach(q => { totalCount++; if (this.answers[q.id] === q.ans) correctCount++; }); }); const score = ((correctCount / totalCount) * 10).toFixed(2); const skipped = totalCount - Object.keys(this.answers).length; const wrong = totalCount - correctCount - skipped; this.hideExamUI(); const tpl = document.getElementById('tpl-result'); document.getElementById('app-container').innerHTML = tpl.innerHTML; document.getElementById('result-score').innerText = score; document.getElementById('result-correct').innerText = correctCount; document.getElementById('result-wrong').innerText = wrong; document.getElementById('result-skipped').innerText = skipped; },
    reviewExam() { this.isReviewMode = true; this.reviewFilter = 'all'; document.body.classList.add('review-mode'); document.getElementById('exam-timer').classList.add('hidden'); document.getElementById('btn-submit').classList.add('hidden'); document.getElementById('section-progress').classList.add('hidden'); document.getElementById('review-filters').classList.remove('hidden'); document.getElementById('review-filters').classList.add('flex'); document.getElementById('btn-close-review').classList.remove('hidden'); document.getElementById('bottom-nav').classList.remove('hidden'); document.getElementById('bottom-nav').classList.add('flex'); this.currentSectionIndex = 0; this.renderSection(); this.renderGlobalBottomNav(); },
    setReviewFilter(filter) { this.reviewFilter = filter; document.querySelectorAll('.filter-btn').forEach(btn => { btn.classList.remove('active', 'bg-blue-600', 'text-white'); btn.classList.add('text-slate-500'); if (btn.innerText.toLowerCase().includes(filter === 'all' ? 'tất cả' : (filter === 'correct' ? 'đúng' : 'sai'))) { btn.classList.add('active'); btn.classList.remove('text-slate-500'); } }); this.renderSection(); }
};

app.init();

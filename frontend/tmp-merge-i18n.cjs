// Throwaway: deep-merges new i18n keys into ru.json / en.json / uz.json
// for the F1–F5 frontend slices. Each leaf carries {ru, en, uz} triples;
// the merger fans them out into the three locale files at the matching
// nested path.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, 'src', 'locales');

const NEW = {
    common: {
        back:   { ru: 'Назад', en: 'Back', uz: 'Orqaga' },
        next:   { ru: 'Далее', en: 'Next', uz: 'Keyingi' },
        all:    { ru: 'Все', en: 'All', uz: 'Hammasi' },
        done:   { ru: 'Готово', en: 'Done', uz: 'Tayyor' },
    },
    pageTitles: {
        '/organizations':    { ru: 'Организации', en: 'Organizations', uz: 'Tashkilotlar' },
        '/onboarding':       { ru: 'Создание организации', en: 'Onboarding', uz: 'Tashkilot yaratish' },
        '/periods':          { ru: 'Отчётные периоды', en: 'Reporting periods', uz: 'Hisobot davrlari' },
        '/chart':            { ru: 'План счетов', en: 'Chart of accounts', uz: 'Hisoblar reja' },
        '/matrix':           { ru: 'Матрица трансформации', en: 'Transformation matrix', uz: 'Transformatsiya matritsasi' },
        '/osvImport':        { ru: 'Импорт ОСВ', en: 'Trial balance import', uz: 'OSV importi' },
        '/bankUpload':       { ru: 'Загрузка выписки', en: 'Bank statement upload', uz: 'Bank koʻchirmasi' },
        '/bankPreview':      { ru: 'Просмотр выписки', en: 'Statement preview', uz: 'Koʻchirma koʻrish' },
        '/adjustments':      { ru: 'Корректировки', en: 'Adjustments', uz: 'Tuzatishlar' },
        '/adjustmentNew':    { ru: 'Новая корректировка', en: 'New adjustment', uz: 'Yangi tuzatish' },
        '/adjustmentDetail': { ru: 'Корректировка', en: 'Adjustment', uz: 'Tuzatish' },
    },
    organizations: {
        title:     { ru: 'Мои организации', en: 'My organizations', uz: 'Mening tashkilotlarim' },
        subtitle:  { ru: 'Переключайтесь между организациями или создайте новую.', en: 'Switch between organizations or create a new one.', uz: 'Tashkilotlar oʻrtasida almashing yoki yangisini yarating.' },
        createNew: { ru: 'Создать организацию', en: 'Create organization', uz: 'Yangi tashkilot' },
        list: {
            title:       { ru: 'Активные', en: 'Active', uz: 'Faol' },
            empty:       { ru: 'Пока нет ни одной организации. Создайте первую, чтобы начать.', en: 'No organizations yet. Create your first to get started.', uz: 'Hali tashkilot yoʻq. Boshlash uchun birinchisini yarating.' },
            activeBadge: { ru: 'Активная', en: 'Active', uz: 'Faol' },
        },
        invites: {
            title:     { ru: 'Приглашения', en: 'Invites', uz: 'Takliflar' },
            invitedAs: { ru: 'Приглашены как {role}', en: 'Invited as {role}', uz: '{role} sifatida' },
            accept:    { ru: 'Принять', en: 'Accept', uz: 'Qabul qilish' },
        },
        role: {
            admin:  { ru: 'Администратор', en: 'Admin', uz: 'Administrator' },
            member: { ru: 'Участник', en: 'Member', uz: 'Aʼzo' },
        },
        switcher: {
            activeLabel: { ru: 'Организация', en: 'Organization', uz: 'Tashkilot' },
            none:        { ru: 'Не выбрана', en: 'None selected', uz: 'Tanlanmagan' },
            switchTo:    { ru: 'Переключить на', en: 'Switch to', uz: 'Almashish' },
            manage:      { ru: 'Управление организациями', en: 'Manage organizations', uz: 'Boshqaruv' },
            createFirst: { ru: 'Создать первую', en: 'Create first', uz: 'Birinchisini yaratish' },
        },
    },
    onboarding: {
        title:    { ru: 'Настройка новой организации', en: 'Set up your organization', uz: 'Tashkilotni sozlash' },
        subtitle: { ru: 'Несколько шагов — и ваш учётный контур готов к работе.', en: 'A few steps and your accounting workspace is ready.', uz: 'Bir necha qadam — va sizning hisobot maydoningiz tayyor.' },
        step1:    { ru: 'Реквизиты', en: 'Identity', uz: 'Maʼlumotlar' },
        step2:    { ru: 'Период перехода', en: 'Transition', uz: 'Oʻtish davri' },
        step3:    { ru: 'Подтверждение', en: 'Review', uz: 'Tasdiqlash' },
        creating: { ru: 'Создаём…', en: 'Creating…', uz: 'Yaratilmoqda…' },
        submit:   { ru: 'Создать организацию', en: 'Create organization', uz: 'Yaratish' },
        fields: {
            name:                  { ru: 'Название', en: 'Display name', uz: 'Nomi' },
            namePlaceholder:       { ru: 'EX-IM Equipment', en: 'EX-IM Equipment', uz: 'EX-IM Equipment' },
            nameHelp:              { ru: 'Короткое название для внутреннего использования.', en: 'Short name for in-product use.', uz: 'Ichki foydalanish uchun qisqa nom.' },
            legalName:             { ru: 'Юридическое название', en: 'Legal name', uz: 'Yuridik nom' },
            legalNamePlaceholder:  { ru: '«ODTI» MChJ', en: 'ODTI LLC', uz: 'ODTI MChJ' },
            legalNameHelp:         { ru: 'Полное название как в реестре. Появится в отчётности.', en: 'Full registered name. Renders on statements.', uz: 'Reestrdagi toʻliq nom.' },
            inn:                   { ru: 'ИНН', en: 'TIN', uz: 'STIR' },
            innPlaceholder:        { ru: '300123456', en: '300123456', uz: '300123456' },
            innHelp:               { ru: 'Используется для распознавания выписок банка.', en: 'Used to attribute incoming bank statements.', uz: 'Bank koʻchirmalarini taqsimlash uchun.' },
            firstReportingYear:    { ru: 'Первый отчётный год по МСФО', en: 'First IFRS reporting year', uz: 'Birinchi IFRS hisobot yili' },
            firstReportingYearHelp:{ ru: 'Календарный год, за который сдаётся первый полный комплект.', en: 'Calendar year of the first full statement set.', uz: 'Birinchi toʻliq hisobot yili.' },
            transitionDate:        { ru: 'Дата перехода', en: 'Transition date', uz: 'Oʻtish sanasi' },
            transitionDateHelp:    { ru: 'Начало сравнительного года. Обычно 01.01 предыдущего года.', en: 'Start of the comparative year. Usually Jan 1 of the prior year.', uz: 'Solishtirma yilining boshlanishi.' },
            baseCurrency:          { ru: 'Базовая валюта', en: 'Base currency', uz: 'Asosiy valyuta' },
            baseCurrencyHelp:      { ru: 'Трёхбуквенный код ISO. По умолчанию UZS.', en: 'Three-letter ISO code. Defaults to UZS.', uz: 'Uch harfli ISO kodi. UZS odatda.' },
        },
        review: {
            title: { ru: 'Проверьте данные', en: 'Verify before creating', uz: 'Tekshirib chiqing' },
            note:  { ru: 'При создании автоматически загружается план счетов НСБУ и создаются три отчётных периода (вступительный, сравнительный, отчётный).', en: 'On create we seed the NSBU chart of accounts and create three reporting periods (opening, comparative, reporting).', uz: 'NSBU hisoblar rejasi va uch davr (kirish, solishtirma, hisobot) avtomatik yaratiladi.' },
        },
    },
    osvUpload: {
        title:          { ru: 'Импорт оборотно-сальдовой ведомости', en: 'Import trial balance', uz: 'OSV importi' },
        subtitle:       { ru: 'Загрузите экспорт ОСВ из 1С. Записывается в слой НСБУ-баланса для выбранного периода.', en: 'Upload a 1C ОСВ export. Writes to the NSBU-base layer for the selected period.', uz: '1C dan OSV faylni yuklang.' },
        targetPeriod:   { ru: 'Период загрузки', en: 'Target period', uz: 'Yuklash davri' },
        dropTitle:      { ru: 'Перетащите файл или нажмите для выбора', en: 'Drop the file or click to pick', uz: 'Faylni tashlang yoki tanlang' },
        dropSub:        { ru: '.xlsx или .xls из 1C', en: '.xlsx or .xls from 1C', uz: '.xlsx yoki .xls' },
        replaceWarning: { ru: 'Загрузка полностью заменит существующие НСБУ-балансы за этот период.', en: 'Upload fully replaces existing NSBU balances for this period.', uz: 'Mavjud balanslar qayta yoziladi.' },
        uploading:      { ru: 'Загружаем…', en: 'Uploading…', uz: 'Yuklanmoqda…' },
        submit:         { ru: 'Загрузить', en: 'Upload', uz: 'Yuklash' },
        summary: {
            title:         { ru: 'Результат импорта', en: 'Import result', uz: 'Import natijasi' },
            companyHeader: { ru: 'Заголовок организации', en: 'Company header', uz: 'Tashkilot sarlavhasi' },
            periodHeader:  { ru: 'Заголовок периода', en: 'Period header', uz: 'Davr sarlavhasi' },
            inserted:      { ru: 'Создано строк', en: 'Inserted rows', uz: 'Qoʻshildi' },
            replaced:      { ru: 'Заменено строк', en: 'Replaced rows', uz: 'Almashtirildi' },
            unknown:       { ru: 'Неизвестные коды счетов', en: 'Unknown account codes', uz: 'Notanish hisoblar' },
            warnings:      { ru: 'Предупреждения парсера', en: 'Parser warnings', uz: 'Parser ogohlantirishlari' },
            moreWarnings:  { ru: 'ещё', en: 'more', uz: 'yana' },
        },
    },
    bankUpload: {
        title:        { ru: 'Загрузка банковской выписки', en: 'Bank statement upload', uz: 'Bank koʻchirmasi' },
        subtitle:     { ru: 'Файл будет разнесён построчно с предпросмотром перед проводкой.', en: 'The file is parsed row-by-row; review before posting.', uz: 'Fayl tahlil qilinadi.' },
        targetPeriod: { ru: 'Период загрузки', en: 'Target period', uz: 'Davr' },
        dropTitle:    { ru: 'Перетащите выписку', en: 'Drop the statement', uz: 'Koʻchirmani tashlang' },
        dropSub:      { ru: '.xlsx или .xls', en: '.xlsx or .xls', uz: '.xlsx yoki .xls' },
        uploading:    { ru: 'Загружаем…', en: 'Uploading…', uz: 'Yuklanmoqda…' },
        submit:       { ru: 'Разобрать', en: 'Parse', uz: 'Tahlil qilish' },
    },
    bankPreview: {
        title:    { ru: 'Предпросмотр проводок', en: 'Posting preview', uz: 'Koʻrib chiqish' },
        subtitle: { ru: 'Зелёные — готовы. Жёлтые — проверьте. Красные — выберите счёт.', en: 'Green: ready. Yellow: verify. Red: pick account.', uz: 'Yashil/Sariq/Qizil.' },
        colors: {
            green:  { ru: 'распознано', en: 'recognized', uz: 'aniqlandi' },
            yellow: { ru: 'проверить', en: 'verify', uz: 'tekshiring' },
            red:    { ru: 'требует ввода', en: 'needs input', uz: 'kiritish kerak' },
        },
        cols: {
            row:         { ru: 'Строка', en: 'Row', uz: 'Satr' },
            date:        { ru: 'Дата', en: 'Date', uz: 'Sana' },
            description: { ru: 'Описание', en: 'Description', uz: 'Tavsif' },
            amount:      { ru: 'Сумма', en: 'Amount', uz: 'Summa' },
            status:      { ru: 'Статус', en: 'Status', uz: 'Holat' },
            actions:     { ru: 'Действия', en: 'Actions', uz: 'Amallar' },
        },
        actions: {
            fix: { ru: 'Исправить', en: 'Fix', uz: 'Tuzatish' },
        },
        empty:        { ru: 'Нет черновиков для этой загрузки.', en: 'No drafts for this upload.', uz: 'Qoralama yoʻq.' },
        commitHelp:   { ru: 'Красные строки ({red}) будут пропущены — исправьте их перед проведением.', en: 'Red rows ({red}) will be skipped — fix before posting.', uz: 'Qizil satrlar ({red}) oʻtkazib yuboriladi.' },
        commitButton: { ru: 'Провести выписку', en: 'Post statement', uz: 'Qabul qilish' },
        committing:   { ru: 'Проводим…', en: 'Posting…', uz: 'Qabul qilinmoqda…' },
        editor: {
            title:           { ru: 'Исправить строку', en: 'Fix row', uz: 'Satrni tuzatish' },
            accountCode:     { ru: 'Код счёта', en: 'Account code', uz: 'Hisob kodi' },
            accountCodeHelp: { ru: 'НСБУ-код, например 6010 или 4420.', en: 'NSBU code, e.g. 6010 or 4420.', uz: 'NSBU kodi.' },
            description:     { ru: 'Описание', en: 'Description', uz: 'Tavsif' },
            learnRule:       { ru: 'Добавить в правила', en: 'Add to rules', uz: 'Qoidaga qoʻshish' },
        },
    },
    adjustments: {
        title:    { ru: 'Корректировки МСФО', en: 'IFRS adjustments', uz: 'IFRS tuzatishlari' },
        subtitle: { ru: 'Слой МСФО над незыблемой базой НСБУ.', en: 'IFRS overlay on the immutable NSBU base.', uz: 'NSBU bazasi ustidagi IFRS qatlami.' },
        create:   { ru: 'Новая корректировка', en: 'New adjustment', uz: 'Yangi tuzatish' },
        empty:    { ru: 'Пока нет корректировок.', en: 'No adjustments yet.', uz: 'Hali yoʻq.' },
        filters: {
            status:   { ru: 'Статус', en: 'Status', uz: 'Holat' },
            standard: { ru: 'Стандарт', en: 'Standard', uz: 'Standart' },
        },
        cols: {
            date:     { ru: 'Дата', en: 'Date', uz: 'Sana' },
            standard: { ru: 'Стандарт', en: 'Standard', uz: 'Standart' },
            reason:   { ru: 'Причина', en: 'Reason', uz: 'Sabab' },
            amount:   { ru: 'Сумма', en: 'Amount', uz: 'Summa' },
            status:   { ru: 'Статус', en: 'Status', uz: 'Holat' },
        },
        status: {
            draft:     { ru: 'Черновик', en: 'Draft', uz: 'Qoralama' },
            committed: { ru: 'Проведён', en: 'Committed', uz: 'Qabul qilingan' },
            reversed:  { ru: 'Сторнирован', en: 'Reversed', uz: 'Bekor qilingan' },
        },
        editor: {
            titleNew:   { ru: 'Новая корректировка', en: 'New adjustment', uz: 'Yangi tuzatish' },
            titleView:  { ru: 'Корректировка', en: 'Adjustment', uz: 'Tuzatish' },
            date:       { ru: 'Дата', en: 'Date', uz: 'Sana' },
            standard:   { ru: 'Стандарт МСФО', en: 'IFRS standard', uz: 'IFRS standarti' },
            reason:     { ru: 'Причина', en: 'Reason', uz: 'Sabab' },
            taxEffect:  { ru: 'Эффект отложенного налога', en: 'Deferred tax effect', uz: 'Soliq effekti' },
            disclosure: { ru: 'Текст раскрытия', en: 'Disclosure text', uz: 'Eslatma matni' },
            cols: {
                account:     { ru: 'Счёт', en: 'Account', uz: 'Hisob' },
                direction:   { ru: 'Сторона', en: 'Side', uz: 'Tomon' },
                amount:      { ru: 'Сумма', en: 'Amount', uz: 'Summa' },
                description: { ru: 'Комментарий', en: 'Comment', uz: 'Izoh' },
            },
            addLine:     { ru: 'Добавить строку', en: 'Add line', uz: 'Qoʻshish' },
            totalDebit:  { ru: 'Итого Дт', en: 'Total Dt', uz: 'Jami Dt' },
            totalCredit: { ru: 'Итого Кт', en: 'Total Cr', uz: 'Jami Cr' },
            balanced:    { ru: 'Сбалансировано', en: 'Balanced', uz: 'Muvozanatda' },
            unbalanced:  { ru: 'Разница: {diff}', en: 'Diff: {diff}', uz: 'Farq: {diff}' },
            saveDraft:   { ru: 'Сохранить черновик', en: 'Save draft', uz: 'Saqlash' },
            commit:      { ru: 'Провести', en: 'Commit', uz: 'Qabul qilish' },
            reverse:     { ru: 'Сторнировать', en: 'Reverse', uz: 'Bekor qilish' },
        },
    },
    periods: {
        title:    { ru: 'Отчётные периоды', en: 'Reporting periods', uz: 'Hisobot davrlari' },
        subtitle: { ru: 'Каждый период имеет собственный набор балансов, проводок и корректировок.', en: 'Each period has its own balances, postings, and adjustments.', uz: 'Har bir davr alohida balanslarga ega.' },
        empty:    { ru: 'Нет периодов.', en: 'No periods.', uz: 'Davrlar yoʻq.' },
        locked:   { ru: 'Закрыт', en: 'Locked', uz: 'Yopiq' },
        kind: {
            opening:     { ru: 'Вступительный', en: 'Opening', uz: 'Kirish' },
            comparative: { ru: 'Сравнительный', en: 'Comparative', uz: 'Solishtirma' },
            reporting:   { ru: 'Отчётный', en: 'Reporting', uz: 'Hisobot' },
            regular:     { ru: 'Обычный', en: 'Regular', uz: 'Oddiy' },
        },
        actions: {
            osv:        { ru: 'Загрузить ОСВ', en: 'Upload trial balance', uz: 'OSV yuklash' },
            bank:       { ru: 'Загрузить выписку', en: 'Upload statement', uz: 'Koʻchirma' },
            adjustment: { ru: 'Создать корректировку', en: 'New adjustment', uz: 'Tuzatish' },
        },
    },
    chart: {
        title:             { ru: 'План счетов НСБУ', en: 'NSBU chart of accounts', uz: 'NSBU hisoblar rejasi' },
        subtitle:          { ru: '507 счетов из канонической версии 1С «УЗ».', en: '507 accounts from the canonical 1C "УЗ" set.', uz: '1C dan 507 hisob.' },
        searchPlaceholder: { ru: 'Поиск по коду или названию…', en: 'Search by code or name…', uz: 'Qidirish…' },
        allVids:           { ru: 'Все виды', en: 'All types', uz: 'Barcha turlar' },
        empty:             { ru: 'План счетов не загружен.', en: 'Chart not loaded.', uz: 'Hisoblar yuklanmagan.' },
        emptyNote:         { ru: 'Backend endpoint для чтения плана счетов появится в следующих коммитах.', en: 'A read endpoint for the chart lands in a follow-up commit.', uz: 'Oʻqish endpointi keyingi kommitlarda.' },
        cols: {
            code:     { ru: 'Код', en: 'Code', uz: 'Kod' },
            name:     { ru: 'Наименование', en: 'Name', uz: 'Nomi' },
            vid:      { ru: 'Вид', en: 'Type', uz: 'Tur' },
            subconto: { ru: 'Субконто', en: 'Subconto', uz: 'Subkonto' },
        },
        vid: {
            active:        { ru: 'Активный', en: 'Active', uz: 'Aktiv' },
            passive:       { ru: 'Пассивный', en: 'Passive', uz: 'Passiv' },
            contraActive:  { ru: 'Контр-активный', en: 'Contra-active', uz: 'Kontr-aktiv' },
            contraPassive: { ru: 'Контр-пассивный', en: 'Contra-passive', uz: 'Kontr-passiv' },
            technical:     { ru: 'Технический', en: 'Technical', uz: 'Texnik' },
        },
    },
    matrix: {
        title:    { ru: 'Матрица трансформации', en: 'Transformation matrix', uz: 'Transformatsiya matritsasi' },
        subtitle: { ru: 'НСБУ → Реклассификация → Корректировки → МСФО.', en: 'NSBU → Reclassification → Adjustments → IFRS.', uz: 'NSBU → Tasniflash → Tuzatishlar → IFRS.' },
        period:   { ru: 'Период', en: 'Period', uz: 'Davr' },
        empty:    { ru: 'Нет балансов для выбранного периода.', en: 'No balances for the selected period.', uz: 'Balanslar yoʻq.' },
        cols: { account: { ru: 'Счёт / Субконто', en: 'Account / Subconto', uz: 'Hisob / Subkonto' } },
        layer: {
            nsbu:       { ru: 'НСБУ', en: 'NSBU', uz: 'NSBU' },
            reclass:    { ru: 'Реклассификация', en: 'Reclass', uz: 'Tasniflash' },
            adjustment: { ru: 'Корректировка', en: 'Adjustment', uz: 'Tuzatish' },
            ifrs:       { ru: 'МСФО', en: 'IFRS', uz: 'IFRS' },
        },
    },
};

function setNested(obj, dotPath, value) {
    const keys = dotPath.split('.');
    let cursor = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (cursor[k] === undefined || typeof cursor[k] !== 'object' || Array.isArray(cursor[k])) cursor[k] = {};
        cursor = cursor[k];
    }
    cursor[keys[keys.length - 1]] = value;
}

function flatten(obj, prefix = '') {
    const out = [];
    for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? prefix + '.' + k : k;
        if (v && typeof v === 'object' && !Array.isArray(v) && !('ru' in v && 'en' in v && 'uz' in v)) {
            out.push(...flatten(v, key));
        } else {
            out.push([key, v]);
        }
    }
    return out;
}

const entries = flatten(NEW);

for (const locale of ['ru', 'en', 'uz']) {
    const filePath = path.join(DIR, locale + '.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const [key, trio] of entries) {
        setNested(data, key, trio[locale]);
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4) + '\n', 'utf8');
    console.log('updated ' + locale + '.json: +' + entries.length + ' keys');
}

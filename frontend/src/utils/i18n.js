// Language files
const messages = {
    ru: {
        nav: {
            home: 'Главная',
            dashboard: 'Рабочий стол',
            templates: 'Шаблоны',
            profile: 'Профиль',
            history: 'История файлов',
            logout: 'Выйти',
            features: 'Возможности',
            howItWorks: 'Как это работает',
            pricing: 'Тарифы'
        },
        hero: {
            title: 'Мощная платформа для автоматизации Excel расчетов по МСФО',
            subtitle: 'С ATABAI закрытие отчетности станет дешевле и быстрее в десятки раз',
            tryFree: 'Попробовать бесплатно',
            loginGoogle: 'Войти через Google'
        },
        stats: {
            minute: 'мин.',
            analysisTime: 'Время анализа 1000+ Excel файлов',
            accuracy: 'Точность расчетов',
            availability: 'Работает без перерывов',
            timeSaving: 'Экономия времени через автоматизацию'
        },
        howItWorks: {
            title: 'Как это работает',
            step1: {
                title: 'Загрузите Excel файлы',
                description: 'Загрузите ваши финансовые файлы Excel для обработки в соответствии с требованиями МСФО',
                uploadText: 'Перетащите файлы сюда или нажмите для выбора',
                supportedFormats: 'Поддерживаются форматы: .xlsx, .xls, .csv'
            },
            step2: {
                title: 'Выберите шаблон МСФО',
                description: 'Выберите подходящий шаблон расчетов в соответствии с международными стандартами финансовой отчетности'
            },
            step3: {
                title: 'Получите готовые результаты',
                description: 'Скачайте обработанные файлы с примененными формулами МСФО и детальным отчетом об изменениях',
                processed: 'Файл обработан',
                changes: 'Изменений',
                formulas: 'Формул применено'
            }
        },
        features: {
            title: 'Почему ATABAI превосходен',
            automation: {
                title: 'Полная автоматизация',
                description: 'Автоматическое применение формул МСФО к вашим Excel файлам'
            },
            compliance: {
                title: 'Соответствие МСФО',
                description: 'Соблюдение требований международных стандартов финансовой отчетности'
            },
            accuracy: {
                title: 'Высокая точность',
                description: 'Минимизация ошибок в финансовых расчетах'
            },
            speed: {
                title: 'Быстрая обработка',
                description: 'Обработка больших файлов за считанные минуты'
            },
            easy: {
                title: 'Простота использования',
                description: 'Интуитивный интерфейс не требует специального обучения'
            },
            universal: {
                title: 'Универсальность',
                description: 'Подходит для любых типов финансовых расчетов и отчетов'
            }
        },
        templates: {
            depreciation: 'Амортизация основных средств',
            discounts: 'Расчеты скидок',
            impairment: 'Обесценение активов',
            reports: 'Финансовые отчеты'
        },
        pricing: {
            title: 'ATABAI поможет вам сэкономить время и деньги',
            popular: 'Популярный',
            getStarted: 'Начать работу',
            contactUs: 'Связаться с нами',
            basic: {
                title: 'Базовый',
                price: 'Бесплатно',
                files: '5 файлов в месяц',
                templates: 'Базовые шаблоны МСФО',
                history: 'История последних 10 файлов',
                export: 'Экспорт обработанных файлов'
            },
            premium: {
                title: 'Премиум',
                price: 'По запросу',
                perMonth: 'Индивидуальная стоимость',
                files: 'Неограниченное количество файлов',
                templates: 'Все шаблоны МСФО',
                priority: 'Приоритетная обработка',
                history: 'Полная история обработки',
                support: 'Техническая поддержка',
                api: 'API доступ'
            },
            enterprise: {
                title: 'Корпоративный',
                price: 'Индивидуально',
                custom: 'Настройка под ваши потребности',
                dedicated: 'Выделенный сервер',
                sla: 'SLA соглашение',
                training: 'Обучение команды'
            }
        },
        cta: {
            title: 'Попробуйте сейчас бесплатно',
            subtitle: 'Для любой из ваших задач и убедитесь в эффективности ATABAI',
            button: 'Попробовать сейчас'
        },
        finalCta: {
            title: 'Готовы начать?',
            subtitle: 'Начните автоматизировать ваши МСФО расчеты уже сегодня',
            button: 'Начать работу'
        },
        auth: {
            signIn: 'Войти',
            signOut: 'Выйти',
            signInWithGoogle: 'Войти через Google'
        },
        common: {
            loading: 'Загрузка...',
            error: 'Ошибка',
            success: 'Успешно',
            cancel: 'Отмена',
            save: 'Сохранить',
            delete: 'Удалить',
            edit: 'Редактировать',
            upload: 'Загрузить',
            download: 'Скачать',
            process: 'Обработать'
        }
    },
    uz: {
        nav: {
            home: 'Bosh sahifa',
            dashboard: 'Boshqaruv paneli',
            templates: 'Shablonlar',
            profile: 'Profil',
            history: 'Fayllar tarixi',
            logout: 'Chiqish',
            features: 'Imkoniyatlar',
            howItWorks: 'Qanday ishlaydi',
            pricing: 'Tariflar'
        },
        hero: {
            title: 'IFRS bo\'yicha Excel hisob-kitoblarini avtomatlashtirishning kuchli platformasi',
            subtitle: 'ATABAI bilan hisobot tayyorlash o\'n marta arzonroq va tezroq bo\'ladi',
            tryFree: 'Bepul sinab ko\'ring',
            loginGoogle: 'Google orqali kirish'
        },
        stats: {
            minute: 'daq.',
            analysisTime: '1000+ Excel fayllarini tahlil qilish vaqti',
            accuracy: 'Hisob-kitob aniqligi',
            availability: 'Tanaffussiz ishlaydi',
            timeSaving: 'Avtomatlashtirish orqali vaqt tejash'
        },
        howItWorks: {
            title: 'Qanday ishlaydi',
            step1: {
                title: 'Excel fayllarini yuklang',
                description: 'IFRS talablariga muvofiq qayta ishlash uchun moliyaviy Excel fayllaringizni yuklang',
                uploadText: 'Fayllarni bu yerga torting yoki tanlash uchun bosing',
                supportedFormats: 'Qo\'llab-quvvatlanadigan formatlar: .xlsx, .xls, .csv'
            },
            step2: {
                title: 'IFRS shablonini tanlang',
                description: 'Xalqaro moliyaviy hisobot standartlariga muvofiq mos hisob-kitob shablonini tanlang'
            },
            step3: {
                title: 'Tayyor natijalarni oling',
                description: 'IFRS formulalari qo\'llanilgan va o\'zgarishlar haqida batafsil hisoboti bilan qayta ishlangan fayllarni yuklab oling',
                processed: 'Fayl qayta ishlandi',
                changes: 'O\'zgarishlar',
                formulas: 'Formula qo\'llanildi'
            }
        },
        features: {
            title: 'Nima uchun ATABAI zo\'r',
            automation: {
                title: 'To\'liq avtomatlashtirish',
                description: 'Excel fayllaringizga IFRS formulalarini avtomatik qo\'llash'
            },
            compliance: {
                title: 'IFRS talablariga muvofiqlik',
                description: 'Xalqaro moliyaviy hisobot standartlari talablariga rioya qilish'
            },
            accuracy: {
                title: 'Yuqori aniqlik',
                description: 'Moliyaviy hisob-kitoblardagi xatolarni minimallash'
            },
            speed: {
                title: 'Tez ishlov berish',
                description: 'Katta fayllarni bir necha daqiqada qayta ishlash'
            },
            easy: {
                title: 'Foydalanish osonligi',
                description: 'Intuitiv interfeys maxsus o\'qitishni talab qilmaydi'
            },
            universal: {
                title: 'Universal',
                description: 'Har qanday turdagi moliyaviy hisob-kitoblar va hisobotlar uchun mos'
            }
        },
        templates: {
            depreciation: 'Asosiy vositalarning amortizatsiyasi',
            discounts: 'Chegirmalar hisob-kitobi',
            impairment: 'Aktivlarning qadrsizlanishi',
            reports: 'Moliyaviy hisobotlar'
        },
        pricing: {
            title: 'ATABAI vaqt va pulni tejashga yordam beradi',
            popular: 'Mashhur',
            getStarted: 'Boshlash',
            contactUs: 'Biz bilan bog\'laning',
            basic: {
                title: 'Asosiy',
                price: 'Bepul',
                files: 'Oyiga 5 ta fayl',
                templates: 'Asosiy IFRS shablonlari',
                history: 'Oxirgi 10 ta fayl tarixi',
                export: 'Qayta ishlangan fayllarni eksport qilish'
            },
            premium: {
                title: 'Premium',
                price: 'So\'rov bo\'yicha',
                perMonth: 'Individual narx',
                files: 'Cheksiz fayllar soni',
                templates: 'Barcha IFRS shablonlari',
                priority: 'Ustuvor qayta ishlash',
                history: 'To\'liq qayta ishlash tarixi',
                support: 'Texnik yordam',
                api: 'API kirish'
            },
            enterprise: {
                title: 'Korporativ',
                price: 'Individual',
                custom: 'Ehtiyojlaringizga moslash',
                dedicated: 'Maxsus server',
                sla: 'SLA shartnoma',
                training: 'Jamoa o\'qitish'
            }
        },
        cta: {
            title: 'Hozir bepul sinab ko\'ring',
            subtitle: 'Har qanday vazifangiz uchun va ATABAI samaradorligiga ishonch hosil qiling',
            button: 'Hozir sinab ko\'ring'
        },
        finalCta: {
            title: 'Boshlashga tayyormisiz?',
            subtitle: 'IFRS hisob-kitoblaringizni bugundan boshlab avtomatlashtiring',
            button: 'Ishni boshlash'
        },
        auth: {
            signIn: 'Kirish',
            signOut: 'Chiqish',
            signInWithGoogle: 'Google orqali kirish'
        },
        common: {
            loading: 'Yuklanmoqda...',
            error: 'Xato',
            success: 'Muvaffaqiyatli',
            cancel: 'Bekor qilish',
            save: 'Saqlash',
            delete: 'O\'chirish',
            edit: 'Tahrirlash',
            upload: 'Yuklash',
            download: 'Yuklab olish',
            process: 'Qayta ishlash'
        }
    },
    en: {
        nav: {
            home: 'Home',
            dashboard: 'Dashboard',
            templates: 'Templates',
            profile: 'Profile',
            history: 'File History',
            logout: 'Sign Out',
            features: 'Features',
            howItWorks: 'How It Works',
            pricing: 'Pricing'
        },
        hero: {
            title: 'Powerful platform for automating Excel calculations according to IFRS',
            subtitle: 'With ATABAI, financial reporting will be tens of times cheaper and faster',
            tryFree: 'Try for free',
            loginGoogle: 'Sign in with Google'
        },
        stats: {
            minute: 'min.',
            analysisTime: 'Time to analyze 1000+ Excel files',
            accuracy: 'Calculation accuracy',
            availability: 'Works without breaks',
            timeSaving: 'Time savings through automation'
        },
        howItWorks: {
            title: 'How it works',
            step1: {
                title: 'Upload Excel files',
                description: 'Upload your financial Excel files for processing according to IFRS requirements',
                uploadText: 'Drag files here or click to select',
                supportedFormats: 'Supported formats: .xlsx, .xls, .csv'
            },
            step2: {
                title: 'Select IFRS template',
                description: 'Choose the appropriate calculation template in accordance with international financial reporting standards'
            },
            step3: {
                title: 'Get ready results',
                description: 'Download processed files with applied IFRS formulas and detailed change reports',
                processed: 'File processed',
                changes: 'Changes',
                formulas: 'Formulas applied'
            }
        },
        features: {
            title: 'Why ATABAI is great',
            automation: {
                title: 'Complete Automation',
                description: 'Automatic application of IFRS formulas to your Excel files'
            },
            compliance: {
                title: 'IFRS Compliance',
                description: 'Compliance with international financial reporting standards'
            },
            accuracy: {
                title: 'High Accuracy',
                description: 'Minimizing errors in financial calculations'
            },
            speed: {
                title: 'Fast Processing',
                description: 'Processing large files in minutes'
            },
            easy: {
                title: 'Easy to Use',
                description: 'Intuitive interface requires no special training'
            },
            universal: {
                title: 'Universal',
                description: 'Suitable for any type of financial calculations and reports'
            }
        },
        templates: {
            depreciation: 'Fixed Asset Depreciation',
            discounts: 'Discount Calculations',
            impairment: 'Asset Impairment',
            reports: 'Financial Reports'
        },
        pricing: {
            title: 'ATABAI helps you save time and money',
            popular: 'Popular',
            getStarted: 'Get Started',
            contactUs: 'Contact Us',
            basic: {
                title: 'Basic',
                price: 'Free',
                files: '5 files per month',
                templates: 'Basic IFRS templates',
                history: 'Last 10 files history',
                export: 'Export processed files'
            },
            premium: {
                title: 'Premium',
                price: 'On request',
                perMonth: 'Custom pricing',
                files: 'Unlimited files',
                templates: 'All IFRS templates',
                priority: 'Priority processing',
                history: 'Complete processing history',
                support: 'Technical support',
                api: 'API access'
            },
            enterprise: {
                title: 'Enterprise',
                price: 'Custom',
                custom: 'Customize to your needs',
                dedicated: 'Dedicated server',
                sla: 'SLA agreement',
                training: 'Team training'
            }
        },
        cta: {
            title: 'Try now for free',
            subtitle: 'For any of your tasks and see the effectiveness of ATABAI',
            button: 'Try now'
        },
        finalCta: {
            title: 'Ready to start?',
            subtitle: 'Start automating your IFRS calculations today',
            button: 'Get Started'
        },
        auth: {
            signIn: 'Sign In',
            signOut: 'Sign Out',
            signInWithGoogle: 'Sign in with Google'
        },
        common: {
            loading: 'Loading...',
            error: 'Error',
            success: 'Success',
            cancel: 'Cancel',
            save: 'Save',
            delete: 'Delete',
            edit: 'Edit',
            upload: 'Upload',
            download: 'Download',
            process: 'Process'
        }
    }
}
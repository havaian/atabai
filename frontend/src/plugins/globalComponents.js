import Select from '@/components/ui/Select.vue'
import Input from '@/components/ui/Input.vue'

export default {
    install(app) {
        app.component('Select', Select)
        app.component('Input', Input)
        // Make tObj available in all components
        app.config.globalProperties.$tObj = app.config.globalProperties.$i18n.global.tObj
    }
}
import Select from '@/components/ui/Select.vue'
import Input from '@/components/ui/Input.vue'

export default {
    install(app) {
        app.component('Select', Select)
        app.component('Input', Input)
    }
}
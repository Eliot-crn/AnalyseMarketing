import router from '@adonisjs/core/services/router'

const ProspectsController = () => import('#controllers/prospects_controller')

router.on('/').render('pages/home')
router.get('/api/meta', [ProspectsController, 'meta'])
router.get('/api/prospects', [ProspectsController, 'list'])
router.get('/api/prospects.csv', [ProspectsController, 'csv'])
router.get('/api/stats', [ProspectsController, 'stats'])

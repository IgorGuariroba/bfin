import { Router } from 'express';
import { AccountController } from '../controllers/AccountController';
import { authenticate } from '../middlewares/auth';

const router = Router();
const accountController = new AccountController();

// Todas as rotas de contas requerem autenticação
router.use(authenticate);

router.get('/', (req, res, next) => {
  accountController.list(req, res).catch(next);
});

router.get('/:id', (req, res, next) => {
  accountController.getById(req, res).catch(next);
});

router.post('/', (req, res, next) => {
  accountController.create(req, res).catch(next);
});

router.patch('/:id', (req, res, next) => {
  accountController.update(req, res).catch(next);
});

router.delete('/:id', (req, res, next) => {
  accountController.delete(req, res).catch(next);
});

export default router;

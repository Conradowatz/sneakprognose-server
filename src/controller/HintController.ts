import {NextFunction, Request, Response} from "express";
import {Cinema} from "../entity/Cinema";
import {AppDataSource} from "../app-data-source";

export class HintController {

    private hintRepository = AppDataSource.getRepository(Cinema);

    async all(request: Request, response: Response, next: NextFunction) {
        return this.hintRepository.find();
    }

    async one(request: Request, response: Response, next: NextFunction) {
        return this.hintRepository.findOneBy({id: parseInt(request.params.id)});
    }

    async save(request: Request, response: Response, next: NextFunction) {
        return this.hintRepository.save(request.body);
    }

    async remove(request: Request, response: Response, next: NextFunction) {
        let hintToRemove = await this.hintRepository.findOneBy({id: parseInt(request.params.id)});
        await this.hintRepository.remove(hintToRemove);
    }

}